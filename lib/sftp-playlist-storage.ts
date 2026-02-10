import { ParsedPlaylist, ParsedTrack } from './sftp-playlist-parser';
import { recordPlaylistChange } from './playlist-history';
import { findArtistByName, normalizeArtistName } from '@/lib/storage';
import { prisma } from './prisma';

/**
 * Инициализирует базу данных (заглушка для обратной совместимости)
 */
export async function ensureSftpPlaylistDatabase(): Promise<void> {
  // Prisma автоматически создает таблицы через миграции
  console.log('✅ Используется Supabase PostgreSQL (Prisma)');
}

/**
 * Сохраняет список плейлистов в базу данных
 */
export async function savePlaylists(playlists: ParsedPlaylist[]): Promise<{
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
}> {
  const stats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    errors: [] as string[]
  };
  
  for (const playlist of playlists) {
    try {
      // Парсим артистов из треков
      const tracksByArtist = new Map<string, ParsedTrack[]>();
      
      playlist.tracks.forEach((track: ParsedTrack) => {
        const artistName = track.artistName || 'Unknown';
        if (!tracksByArtist.has(artistName)) {
          tracksByArtist.set(artistName, []);
        }
        tracksByArtist.get(artistName)!.push(track);
      });
      
      // Сохраняем отдельную запись для каждого артиста
      for (const [artistName, artistTracks] of Array.from(tracksByArtist.entries())) {
        // Находим ID артиста
        const artist = await findArtistByName(artistName);
        const artistId = artist?.id || null;
        
        // Проверяем существующий плейлист
        const existing = await prisma.playlist.findFirst({
          where: {
            playlistUrl: playlist.playlistUrl,
            playlistName: playlist.playlistName,
            artistName: artistName
          }
        });
        
        const today = new Date().toISOString().split('T')[0];
        
        if (existing) {
          // Проверяем, изменились ли треки
          const existingTracks = existing.trackData as unknown as ParsedTrack[];
          const tracksChanged = JSON.stringify(existingTracks) !== JSON.stringify(artistTracks);
          
          if (tracksChanged || existing.lastSeenDate !== today) {
            await prisma.playlist.update({
              where: { id: existing.id },
              data: {
                trackData: artistTracks as any,
                lastSeenDate: today,
                updatedAt: new Date()
              }
            });
            
            // Записываем изменение в историю
            if (tracksChanged) {
              for (const track of artistTracks) {
                await recordPlaylistChange({
                  playlistUrl: playlist.playlistUrl,
                  playlistName: playlist.playlistName,
                  platform: playlist.platform,
                  changeType: 'updated',
                  changeDate: today,
                  artistName: artistName,
                  artistId: artistId,
                  trackTitle: track.titleArtist
                });
              }
            }
            
            stats.updated++;
          } else {
            stats.unchanged++;
          }
        } else {
          // Создаем новый плейлист
          await prisma.playlist.create({
            data: {
              id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              playlistUrl: playlist.playlistUrl,
              playlistName: playlist.playlistName,
              platform: playlist.platform,
              artistName: artistName,
              artistId: artistId,
              trackData: artistTracks as any,
              firstSeenDate: today,
              lastSeenDate: today
            }
          });
          
          // Записываем добавление в историю
          for (const track of artistTracks) {
            await recordPlaylistChange({
              playlistUrl: playlist.playlistUrl,
              playlistName: playlist.playlistName,
              platform: playlist.platform,
              changeType: 'added',
              changeDate: today,
              artistName: artistName,
              artistId: artistId,
              trackTitle: track.titleArtist
            });
          }
          
          stats.added++;
        }
      }
    } catch (error) {
      const errorMsg = `Ошибка сохранения плейлиста ${playlist.playlistName}: ${error}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }
  
  return stats;
}

/**
 * Получает все плейлисты
 */
export async function getAllPlaylists(): Promise<any[]> {
  try {
    const playlists = await prisma.playlist.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    
    return playlists.map(p => ({
      id: p.id,
      playlist_url: p.playlistUrl,
      playlist_name: p.playlistName,
      platform: p.platform,
      artist_name: p.artistName,
      artist_id: p.artistId,
      track_data: JSON.stringify(p.trackData),
      first_seen_date: p.firstSeenDate,
      last_seen_date: p.lastSeenDate,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('❌ Ошибка получения плейлистов:', error);
    return [];
  }
}

/**
 * Получает плейлисты по имени артиста
 */
export async function getPlaylistsByArtist(artistName: string): Promise<any[]> {
  try {
    const normalized = normalizeArtistName(artistName);
    
    const playlists = await prisma.playlist.findMany({
      where: {
        artistName: {
          contains: normalized,
          mode: 'insensitive'
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    return playlists.map(p => ({
      id: p.id,
      playlist_url: p.playlistUrl,
      playlist_name: p.playlistName,
      platform: p.platform,
      artist_name: p.artistName,
      artist_id: p.artistId,
      track_data: JSON.stringify(p.trackData),
      first_seen_date: p.firstSeenDate,
      last_seen_date: p.lastSeenDate,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('❌ Ошибка получения плейлистов по артисту:', error);
    return [];
  }
}

/**
 * Получает плейлисты по ID артиста
 */
export async function getPlaylistsByArtistId(artistId: string): Promise<any[]> {
  try {
    const playlists = await prisma.playlist.findMany({
      where: { artistId },
      orderBy: { updatedAt: 'desc' }
    });
    
    return playlists.map(p => ({
      id: p.id,
      playlist_url: p.playlistUrl,
      playlist_name: p.playlistName,
      platform: p.platform,
      artist_name: p.artistName,
      artist_id: p.artistId,
      track_data: JSON.stringify(p.trackData),
      first_seen_date: p.firstSeenDate,
      last_seen_date: p.lastSeenDate,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString()
    }));
  } catch (error) {
    console.error('❌ Ошибка получения плейлистов по ID артиста:', error);
    return [];
  }
}

/**
 * Получает все URL плейлистов
 */
export async function getAllPlaylistUrls(): Promise<Set<string>> {
  try {
    const playlists = await prisma.playlist.findMany({
      select: { playlistUrl: true },
      distinct: ['playlistUrl']
    });
    
    return new Set(playlists.map(p => p.playlistUrl));
  } catch (error) {
    console.error('❌ Ошибка получения URL плейлистов:', error);
    return new Set();
  }
}

/**
 * Удаляет плейлист
 */
export async function deletePlaylist(
  playlistUrl: string,
  playlistName: string
): Promise<boolean> {
  try {
    await prisma.playlist.deleteMany({
      where: {
        playlistUrl,
        playlistName
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка удаления плейлиста:', error);
    return false;
  }
}

/**
 * Автоматически назначает плейлисты артисту по имени
 */
export async function assignPlaylistsToArtist(
  artistId: string,
  artistName: string,
  username: string
): Promise<number> {
  try {
    const normalizedName = normalizeArtistName(artistName);
    const normalizedUsername = normalizeArtistName(username);
    
    // Находим все плейлисты без artistId, где имя артиста совпадает
    const playlists = await prisma.playlist.findMany({
      where: {
        AND: [
          {
            OR: [
              { artistId: null },
              { artistId: '' }
            ]
          },
          {
            OR: [
              {
                artistName: {
                  contains: normalizedName,
                  mode: 'insensitive'
                }
              },
              {
                artistName: {
                  contains: normalizedUsername,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      }
    });
    
    if (playlists.length === 0) {
      return 0;
    }
    
    // Обновляем все найденные плейлисты
    await prisma.playlist.updateMany({
      where: {
        id: {
          in: playlists.map(p => p.id)
        }
      },
      data: {
        artistId
      }
    });
    
    return playlists.length;
  } catch (error) {
    console.error('❌ Ошибка назначения плейлистов артисту:', error);
    return 0;
  }
}

/**
 * Вручную назначает конкретный плейлист артисту
 */
export async function assignPlaylistToArtistManually(
  playlistId: string,
  artistId: string
): Promise<boolean> {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId }
    });
    
    if (!playlist) {
      return false;
    }
    
    await prisma.playlist.update({
      where: { id: playlistId },
      data: { artistId }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка ручного назначения плейлиста:', error);
    return false;
  }
}
