import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAnalyticsMigrationHttpError } from '@/lib/analytics-api-errors'
import { rematchUnmappedAnalytics } from '@/lib/analytics-artist-match'
import { CACHE_TAG_STREAM_ANALYTICS } from '@/lib/dashboard-cache-tags'
import { requireAdmin } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/analytics/rematch
 * Пересопоставить все строки с artistId IS NULL.
 */
export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const result = await rematchUnmappedAnalytics()
    revalidateTag(CACHE_TAG_STREAM_ANALYTICS)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const migrationErr = getAnalyticsMigrationHttpError(error)
    if (migrationErr) {
      return NextResponse.json({ success: false, error: migrationErr.message }, { status: migrationErr.status })
    }
    console.error('❌ rematch analytics:', error)
    return NextResponse.json({ success: false, error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
