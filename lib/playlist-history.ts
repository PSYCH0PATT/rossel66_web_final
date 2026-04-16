import { prisma } from './prisma';

export interface PlaylistHistoryRecord {
  playlistUrl: string;
  playlistName: string;
  platform: string;
  changeType: 'added' | 'updated' | 'removed' | 'position_changed';
  changeDate: string;
  artistName?: string;
  artistId?: string | null;
  trackTitle?: string;
  oldPosition?: number;
  newPosition?: number;
  metadata?: Record<string, any>;
}

/**
 * Инициализирует таблицу истории (заглушка для обратной совместимости)
 */
export async function ensurePlaylistHistoryDatabase(): Promise<void> {
  // Prisma автоматически создает таблицы через миграции
  // История пока хранится в памяти / логах, т.к. отдельная таблица не критична
}

/**
 * Записывает изменение в историю (логирование)
 */
export async function recordPlaylistChange(record: PlaylistHistoryRecord): Promise<void> {
  // Логируем изменение в консоль
  console.log(`📝 Playlist ${record.changeType}: ${record.playlistName} (${record.platform}) - ${record.artistName || 'unknown'}`);
}

/**
 * Получает историю изменений
 */
export async function getPlaylistHistory(filters?: {
  startDate?: string;
  endDate?: string;
  changeType?: string;
  artistName?: string;
  playlistUrl?: string;
  limit?: number;
}): Promise<any[]> {
  // История пока не хранится в отдельной таблице
  return [];
}

/**
 * Очищает плейлисты, которых нет в новых файлах
 * Использует Prisma для работы с Supabase
 */
export async function cleanupRemovedPlaylists(
  currentPlaylistKeys: Set<string>
): Promise<{ removed: number; errors: string[] }> {
  const result = { removed: 0, errors: [] as string[] };

  /** Пустой снимок = нет валидного CSV / парсинг дал 0 плейлистов — нельзя считать «все удалены с SFTP». */
  if (currentPlaylistKeys.size === 0) {
    console.warn(
      "⚠️  cleanupRemovedPlaylists: пропуск — пустой набор ключей (иначе удалились бы все плейлисты в БД)"
    );
    return result;
  }

  try {
    // Получаем все плейлисты из Supabase
    const allPlaylists = await prisma.playlist.findMany({
      select: {
        id: true,
        playlistUrl: true,
        playlistName: true,
        platform: true,
        artistName: true,
        artistId: true
      }
    });
    
    const now = new Date().toISOString().split('T')[0];
    
    for (const playlist of allPlaylists) {
      const key = `${playlist.playlistUrl}|${playlist.playlistName}`;
      
      // Если плейлиста нет в текущих файлах
      if (!currentPlaylistKeys.has(key)) {
        try {
          // Логируем удаление
          console.log(`🗑️  Удаление плейлиста: ${playlist.playlistName} (${playlist.artistName})`);
          
          // Удаляем из базы
          await prisma.playlist.delete({
            where: { id: playlist.id }
          });
          
          result.removed++;
        } catch (error: any) {
          result.errors.push(`Ошибка удаления плейлиста ${playlist.playlistName} (${playlist.artistName}): ${error.message}`);
        }
      }
    }
  } catch (error: any) {
    result.errors.push(`Ошибка получения плейлистов для очистки: ${error.message}`);
  }
  
  return result;
}
