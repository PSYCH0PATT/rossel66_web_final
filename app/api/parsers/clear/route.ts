import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deleteAllPlaylists } from '@/lib/sftp-playlist-storage';
import { getSessionUser, requireAdminOrCron } from '@/lib/server-auth';
import { addActivity } from '@/lib/storage';

/**
 * DELETE /api/parsers/clear
 * Очищает все результаты парсинга плейлистов.
 *
 * F-PARS-1: раньше роут удалял из SQLite (`artist_playlists`/`bandlink_playlists`),
 * причём из таблиц, которых в этих файлах нет → 500 «no such table».
 * Список в UI приходит из Postgres (`/api/playlists/sftp` → prisma.playlist),
 * поэтому очищаем именно его.
 */
export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdminOrCron(request);
    if (denied) return denied;

    const deleted = await deleteAllPlaylists();

    await addActivity({
      type: 'playlist_found',
      userId: getSessionUser()?.id ?? 'cron',
      userRole: 'admin',
      title: 'Результаты парсинга очищены',
      description: `Удалено плейлистов: ${deleted}`,
      metadata: { deleted, action: 'clear_playlists' },
    });

    return NextResponse.json({
      success: true,
      deleted,
      message: `Все результаты парсинга очищены (удалено: ${deleted})`,
    });
  } catch (error) {
    console.error('Ошибка очистки результатов:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка очистки результатов',
    }, { status: 500 });
  }
}
