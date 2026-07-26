import { NextRequest, NextResponse } from 'next/server';
import { getPlaylistHistory } from '@/lib/playlist-history';
import { requireAdmin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic'

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
    const denied = await requireAdmin(request);
    if (denied) return denied;

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

    // A10: Prisma отдаёт camelCase, а страница истории читает snake_case
    // (playlist_name, change_date, …) → все ячейки таблицы были пустыми.
    const results = history.map((row) => ({
      id: row.id,
      playlist_url: row.playlistUrl,
      playlist_name: row.playlistName,
      platform: row.platform,
      change_type: row.changeType,
      change_date: row.changeDate,
      artist_name: row.artistName,
      artist_id: row.artistId,
      track_title: row.trackTitle,
      old_position: row.oldPosition,
      new_position: row.newPosition,
      created_at: row.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      results,
      count: results.length
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
