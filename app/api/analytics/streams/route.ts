import { NextRequest, NextResponse } from 'next/server'
import { getCachedStreamAnalytics } from '@/lib/cached-dashboard'
import { buildAnalyticsFiltersFromRequest } from '@/lib/analytics-request-filters'
import { getSessionUser, requireAuth } from '@/lib/server-auth'
import { jsonWithPerfLog } from '@/lib/api-perf-log'

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
    const filters = await buildAnalyticsFiltersFromRequest(session, searchParams)

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
