import { NextRequest, NextResponse } from 'next/server'
import { getAvailableTracks } from '@/lib/flash-storage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics/tracks
 * Возвращает список уникальных треков для фильтра.
 *
 * Query params:
 *   artistId — фильтр по артисту (опционально)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const artistId = searchParams.get('artistId') || undefined
    const take = Math.min(Number(searchParams.get('take') || '100') || 100, 2000)
    const skip = Math.max(0, Number(searchParams.get('skip') || '0') || 0)
    const tracks = await getAvailableTracks(artistId, { take, skip })

    return NextResponse.json({ success: true, tracks, take, skip })

  } catch (error) {
    console.error('❌ Ошибка получения списка треков:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
