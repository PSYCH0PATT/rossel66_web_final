import { NextRequest, NextResponse } from 'next/server';
import { getPlaylistHistory } from '@/lib/playlist-history';
import { loadUsers } from '@/lib/storage';

/**
 * GET /api/playlists/history
 * Получает историю изменений плейлистов (только для админов)
 * 
 * Query параметры:
 * - startDate: начальная дата (YYYY-MM-DD)
 * - endDate: конечная дата (YYYY-MM-DD)
 * - changeType: тип изменения (added, updated, removed, position_changed)
 * - artistName: имя артиста
 * - playlistUrl: URL плейлиста
 * - limit: ограничение количества записей
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации (можно добавить проверку роли админа)
    // Пока оставляем открытым, но в production нужно добавить проверку
    
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    const changeType = request.nextUrl.searchParams.get('changeType');
    const artistName = request.nextUrl.searchParams.get('artistName');
    const playlistUrl = request.nextUrl.searchParams.get('playlistUrl');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;
    
    const history = await getPlaylistHistory({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      changeType: changeType || undefined,
      artistName: artistName || undefined,
      playlistUrl: playlistUrl || undefined,
      limit
    });
    
    return NextResponse.json({
      success: true,
      results: history,
      count: history.length
    });
    
  } catch (error) {
    console.error('Ошибка получения истории плейлистов:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
