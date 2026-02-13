import { NextRequest, NextResponse } from 'next/server'
import { getAvailableArtists } from '@/lib/flash-storage'

/**
 * GET /api/analytics/artists
 * Возвращает список артистов, для которых есть данные аналитики.
 * Используется в админском дашборде для фильтра.
 */
export async function GET(_request: NextRequest) {
  try {
    const artists = await getAvailableArtists()
    return NextResponse.json({ success: true, artists })
  } catch (error) {
    console.error('❌ Ошибка получения списка артистов аналитики:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
