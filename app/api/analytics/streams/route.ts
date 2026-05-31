import { NextRequest, NextResponse } from 'next/server'
import { getCachedStreamAnalytics } from '@/lib/cached-dashboard'
import { getSessionUser, requireAuth } from '@/lib/server-auth'
import { jsonWithPerfLog } from '@/lib/api-perf-log'
import type { StreamFilters } from '@/lib/flash-storage'

export const dynamic = "force-dynamic"

/**
 * GET /api/analytics/streams
 * Возвращает данные стриминговой аналитики для графиков.
 *
 * Query params:
 *   artistId    — фильтр по артисту
 *   startDate   — начало периода (ISO date) — для XY графиков
 *   endDate     — конец периода (ISO date) — для XY графиков
 *   trackName   — фильтр по конкретному треку
 *   isrc        — фильтр по ISRC трека
 */
export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const pathname = new URL(request.url).pathname

  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const { searchParams } = new URL(request.url)

    let artistId = searchParams.get('artistId') || undefined
    if (session.role === 'artist') {
      artistId = session.id
    }

    const filters: StreamFilters = {
      artistId,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      trackName: searchParams.get('trackName') || undefined,
      isrc: searchParams.get('isrc') || undefined,
    }

    const data = await getCachedStreamAnalytics(filters)

    return jsonWithPerfLog(pathname, startedAt, {
      success: true,
      data,
      cachedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ Ошибка получения stream analytics:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: String(error),
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
