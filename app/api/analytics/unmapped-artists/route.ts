import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsMigrationHttpError } from '@/lib/analytics-api-errors'
import { countUnmappedTrackArtists, listUnmappedTrackArtists } from '@/lib/analytics-artist-match'
import { requireAdmin } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/unmapped-artists
 * Список trackArtist без привязки к профилю.
 */
export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const take = Math.min(Number(searchParams.get('take') || '200') || 200, 2000)
    const skip = Math.max(0, Number(searchParams.get('skip') || '0') || 0)

    const [artists, total] = await Promise.all([
      listUnmappedTrackArtists({ take, skip }),
      countUnmappedTrackArtists(),
    ])

    return NextResponse.json({ success: true, artists, total, take, skip })
  } catch (error) {
    const migrationErr = getAnalyticsMigrationHttpError(error)
    if (migrationErr) {
      return NextResponse.json({ success: false, error: migrationErr.message }, { status: migrationErr.status })
    }
    console.error('❌ unmapped-artists:', error)
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
