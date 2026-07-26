import { ParsedPlaylist, ParsedTrack } from './sftp-playlist-parser';
import { recordPlaylistChange } from './playlist-history';
import { normalizeArtistName } from '@/lib/storage';
import { mskDateString } from '@/lib/msk-date';
import { tokenizeCollaborationArtistField } from '@/lib/playlist-artist-match';
import { userFromPrisma } from '@/lib/storage-adapters';
import { prisma } from './prisma';
import { findManyPlaylistRows } from '@/lib/prisma-playlist-read';
import { revalidateArtistDashboardsForArtistIds } from '@/lib/revalidate-artist-dashboard';

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
export type AddedPlaylistInfo = {
  playlistName: string
  artistName: string
  artistId: string | null
  /** Первый релиз из треков плейлиста (для активности / UI) */
  releaseName?: string
}

export async function savePlaylists(playlists: ParsedPlaylist[]): Promise<{
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
  addedPlaylists: AddedPlaylistInfo[];
}> {
  const stats = {
    added: 0,
    updated: 0,
    unchanged: 0,
    errors: [] as string[],
    addedPlaylists: [] as AddedPlaylistInfo[]
  };
  const touchedArtistIds = new Set<string>();

  const artistRows = await prisma.user.findMany({ where: { role: 'artist' } })
  const artistIdByNormalizedKey = new Map<string, string>()
  for (const row of artistRows) {
    const u = userFromPrisma(row)
    artistIdByNormalizedKey.set(normalizeArtistName(u.name), u.id)
    artistIdByNormalizedKey.set(normalizeArtistName(u.username), u.id)
  }
  /** Совпадение по целой строке или по сегменту коллаба («rompy & лоло» → rompy). */
  const resolveArtistId = (rawName: string): string | null => {
    for (const t of tokenizeCollaborationArtistField(rawName)) {
      const id = artistIdByNormalizedKey.get(t)
      if (id) return id
    }
    return null
  }

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
        const artistId = resolveArtistId(artistName);
        if (artistId) touchedArtistIds.add(artistId);
        
        // Проверяем существующий плейлист
        const existing = await prisma.playlist.findFirst({
          where: {
            playlistUrl: playlist.playlistUrl,
            playlistName: playlist.playlistName,
            artistName: artistName
          }
        });
        
        const today = mskDateString(); // A5: МСК-дата, не UTC (сдвиг на границе суток)
        
        if (existing) {
          // Проверяем, изменились ли треки
          const existingTracks = existing.trackData as unknown as ParsedTrack[];
          const tracksChanged = JSON.stringify(existingTracks) !== JSON.stringify(artistTracks);
          const shouldFillArtistId = !existing.artistId && !!artistId;

          if (tracksChanged || existing.lastSeenDate !== today || shouldFillArtistId) {
            await prisma.playlist.update({
              where: { id: existing.id },
              data: {
                trackData: artistTracks as any,
                lastSeenDate: today,
                updatedAt: new Date(),
                ...(shouldFillArtistId ? { artistId } : {}),
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
          const createdPlaylist = await prisma.playlist.create({
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

          try {
            const { enqueuePlaylistSync } = await import("@/lib/buildin/sync-hooks")
            await enqueuePlaylistSync({
              id: createdPlaylist.id,
              playlistName: createdPlaylist.playlistName,
              playlistUrl: createdPlaylist.playlistUrl,
              platform: createdPlaylist.platform,
              artistId: createdPlaylist.artistId,
              artistName: createdPlaylist.artistName,
              firstSeenDate: createdPlaylist.firstSeenDate,
              lastSeenDate: createdPlaylist.lastSeenDate,
              coverUrl: createdPlaylist.coverUrl,
            })
          } catch (err) {
            console.error("Buildin playlist sync enqueue failed:", err)
          }
          
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
          const firstTrack = artistTracks[0]
          const releaseName =
            firstTrack &&
            ((firstTrack.albumTitle || "").trim() ||
              (firstTrack.trackTitle || "").trim() ||
              (firstTrack.titleArtist || "").trim())
          stats.addedPlaylists.push({
            playlistName: playlist.playlistName,
            artistName,
            artistId,
            ...(releaseName ? { releaseName } : {}),
          });
        }
      }
    } catch (error) {
      const errorMsg = `Ошибка сохранения плейлиста ${playlist.playlistName}: ${error}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  if (touchedArtistIds.size > 0) {
    await revalidateArtistDashboardsForArtistIds([...touchedArtistIds])
  }
  
  return stats;
}

/**
 * Получает все плейлисты
 */
export async function getAllPlaylists(opts?: {
  take?: number
  skip?: number
  where?: import('@prisma/client').Prisma.PlaylistWhereInput
}): Promise<any[]> {
  const take = opts?.take !== undefined ? Math.min(opts.take, 5000) : undefined
  const skip = opts?.skip !== undefined ? Math.max(0, opts.skip) : undefined
  const playlists = await findManyPlaylistRows({
    ...(opts?.where ? { where: opts.where } : {}),
    orderBy: { updatedAt: 'desc' },
    ...(take !== undefined ? { take } : {}),
    ...(skip !== undefined ? { skip } : {}),
  })

  return playlists.map((p) => ({
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
    updated_at: p.updatedAt.toISOString(),
    cover_url: p.coverUrl ?? null,
  }))
}

/**
 * Получает плейлисты по имени артиста
 */
export async function getPlaylistsByArtist(artistName: string): Promise<any[]> {
  const normalized = normalizeArtistName(artistName)

  const playlists = await findManyPlaylistRows({
    where: {
      artistName: {
        contains: normalized,
        mode: 'insensitive',
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return playlists.map((p) => ({
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
    updated_at: p.updatedAt.toISOString(),
    cover_url: p.coverUrl ?? null,
  }))
}

/**
 * Получает плейлисты по ID артиста
 */
export async function getPlaylistsByArtistId(artistId: string): Promise<any[]> {
  const playlists = await findManyPlaylistRows({
    where: { artistId },
    orderBy: { updatedAt: 'desc' },
  })

  return playlists.map((p) => ({
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
    updated_at: p.updatedAt.toISOString(),
    cover_url: p.coverUrl ?? null,
  }))
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
 * Удаляет плейлист по его Postgres id (id, который отдаёт /api/playlists/sftp).
 * Возвращает false, если записи с таким id нет.
 */
export async function deletePlaylistById(id: string): Promise<boolean> {
  try {
    const { count } = await prisma.playlist.deleteMany({ where: { id } });
    return count > 0;
  } catch (error) {
    console.error('❌ Ошибка удаления плейлиста по id:', error);
    return false;
  }
}

/**
 * Полная очистка результатов парсинга плейлистов (кнопка «Очистить» в админке).
 * История изменений (PlaylistHistory) сохраняется — это отдельный журнал.
 */
export async function deleteAllPlaylists(): Promise<number> {
  const { count } = await prisma.playlist.deleteMany({});
  return count;
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
      },
      select: { id: true },
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
