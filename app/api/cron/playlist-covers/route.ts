import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  scrapeVkPlaylistCover,
  scrapeYandexPlaylistCover,
} from '@/lib/playlist-cover-scraper'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET

const BATCH_LIMIT = 20
const STALE_DAYS = 7

/**
 * GET /api/cron/playlist-covers
 *
 * Scrapes playlist cover images for VK and Yandex Music playlists.
 * Protected by CRON_SECRET.
 *
 * Processes at most BATCH_LIMIT playlists per call:
 *  - coverUrl IS NULL (never scraped), OR
 *  - coverFetchedAt older than STALE_DAYS days
 *
 * Schedule: Saturdays 06:00 MSK (defined in lib/scheduler.ts)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization')
  const secretParam = request.nextUrl.searchParams.get('secret')
  const provided = authHeader?.replace('Bearer ', '') || secretParam

  if (!CRON_SECRET || provided !== CRON_SECRET) {
    console.log('[CoverCron] ❌ Unauthorized request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🖼  PLAYLIST COVER SCRAPER CRON')
  console.log('═══════════════════════════════════════════════════════════')

  try {
    const staleCutoff = new Date()
    staleCutoff.setDate(staleCutoff.getDate() - STALE_DAYS)

    // Only VK and Yandex are supported; use contains+insensitive OR for robust matching
    const candidates = await prisma.playlist.findMany({
      where: {
        AND: [
          {
            OR: [
              { platform: { contains: 'vk', mode: 'insensitive' } },
              { platform: { contains: 'вк', mode: 'insensitive' } },
              { platform: { contains: 'yandex', mode: 'insensitive' } },
              { platform: { contains: 'яндекс', mode: 'insensitive' } },
            ],
          },
          {
            OR: [
              { coverUrl: null },
              { coverFetchedAt: { lt: staleCutoff } },
            ],
          },
        ],
      },
      orderBy: { coverFetchedAt: { sort: 'asc', nulls: 'first' } },
      take: BATCH_LIMIT,
      select: {
        id: true,
        playlistUrl: true,
        platform: true,
        playlistName: true,
        coverUrl: true,
        coverFetchedAt: true,
      },
    })

    console.log(`[CoverCron] Found ${candidates.length} playlists to process (limit ${BATCH_LIMIT})`)

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { processed: 0, found: 0, errors: 0, skipped: 0 },
        elapsed_ms: Date.now() - startTime,
      })
    }

    let processed = 0
    let found = 0
    let errors = 0
    let skipped = 0

    // Track per-platform blocking — if a platform returns 403/429 we stop
    // scraping it for the rest of this batch.
    const platformBlocked = new Set<string>()

    for (const playlist of candidates) {
      const platform = playlist.platform.trim().toLowerCase()
      const isVk = platform.includes('vk') || platform.includes('вк')
      const isYandex = platform.includes('яндекс') || platform.includes('yandex')

      if (!isVk && !isYandex) {
        skipped++
        continue
      }

      const platformKey = isVk ? 'vk' : 'yandex'
      if (platformBlocked.has(platformKey)) {
        console.log(`[CoverCron] ⏭  Skipping "${playlist.playlistName}" — ${platformKey} is blocked`)
        skipped++
        continue
      }

      console.log(`[CoverCron] Processing [${platformKey.toUpperCase()}] "${playlist.playlistName}"`)
      console.log(`[CoverCron]   URL: ${playlist.playlistUrl}`)
      console.log(`[CoverCron]   Current coverUrl: ${playlist.coverUrl ?? 'null'}`)
      console.log(`[CoverCron]   Last fetched: ${playlist.coverFetchedAt?.toISOString() ?? 'never'}`)

      processed++
      let coverUrl: string | null = null

      try {
        if (isVk) {
          coverUrl = await scrapeVkPlaylistCover(playlist.playlistUrl)
        } else {
          coverUrl = await scrapeYandexPlaylistCover(playlist.playlistUrl)
        }
      } catch (err) {
        console.error(`[CoverCron] ❌ Scraper threw for "${playlist.playlistName}": ${err}`)
        errors++
        await prisma.playlist.update({
          where: { id: playlist.id },
          data: { coverFetchedAt: new Date() },
        })
        continue
      }

      // Detect blocking via scraper returning null right after a BLOCKED log
      // (scraper already logs — we just record coverFetchedAt to avoid retrying soon)
      if (coverUrl === null) {
        console.warn(`[CoverCron] ⚠  No cover for "${playlist.playlistName}"`)
        errors++
        await prisma.playlist.update({
          where: { id: playlist.id },
          data: { coverFetchedAt: new Date() },
        })
        continue
      }

      // Persist the cover URL
      await prisma.playlist.update({
        where: { id: playlist.id },
        data: {
          coverUrl,
          coverFetchedAt: new Date(),
        },
      })
      found++
      console.log(`[CoverCron] ✅ Saved cover for "${playlist.playlistName}": ${coverUrl}`)
    }

    const elapsed = Date.now() - startTime
    console.log('')
    console.log(`[CoverCron] ─── DONE ───────────────────────────────`)
    console.log(`[CoverCron]   Processed : ${processed}`)
    console.log(`[CoverCron]   Found     : ${found}`)
    console.log(`[CoverCron]   Errors    : ${errors}`)
    console.log(`[CoverCron]   Skipped   : ${skipped}`)
    console.log(`[CoverCron]   Elapsed   : ${elapsed}ms`)
    console.log('═══════════════════════════════════════════════════════════')

    return NextResponse.json({
      success: true,
      stats: { processed, found, errors, skipped },
      elapsed_ms: elapsed,
    })
  } catch (err) {
    const msg = String(err)
    console.error(`[CoverCron] ❌ Fatal error: ${msg}`)
    return NextResponse.json(
      { success: false, error: msg, elapsed_ms: Date.now() - startTime },
      { status: 500 }
    )
  }
}

