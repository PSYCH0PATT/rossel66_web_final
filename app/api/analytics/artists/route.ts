import { NextRequest, NextResponse } from 'next/server'
import { getAvailableArtists } from '@/lib/flash-storage'

/**
 * GET /api/analytics/artists
 * Возвращает список артистов, для которых есть данные аналитики.
 * Используется в админском дашборде для фильтра.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const take = Math.min(Number(searchParams.get('take') || '100') || 100, 2000)
    const skip = Math.max(0, Number(searchParams.get('skip') || '0') || 0)
    const artists = await getAvailableArtists({ take, skip })
    return NextResponse.json({ success: true, artists, take, skip })
  } catch (error) {
    console.error('❌ Ошибка получения списка артистов аналитики:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
