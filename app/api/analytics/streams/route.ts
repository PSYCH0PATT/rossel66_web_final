import { NextRequest, NextResponse } from 'next/server'
import { getStreamAnalytics } from '@/lib/flash-storage'

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
  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      artistId: searchParams.get('artistId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      trackName: searchParams.get('trackName') || undefined,
      isrc: searchParams.get('isrc') || undefined,
    }

    const data = await getStreamAnalytics(filters)

    return NextResponse.json({
      success: true,
      data,
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
