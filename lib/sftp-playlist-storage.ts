import { ParsedPlaylist, ParsedTrack } from './sftp-playlist-parser';
import { recordPlaylistChange } from './playlist-history';
import { normalizeArtistName } from '@/lib/storage';
import { mskDateString } from '@/lib/msk-date';
import { tokenizeCollaborationArtistField } from '@/lib/playlist-artist-match';
import { userFromPrisma } from '@/lib/storage-adapters';
import { prisma } from './prisma';
import { findManyPlaylistRows } from '@/lib/prisma-playlist-read';
import { revalidateArtistDashboardsForArtistIds } from '@/lib/revalidate-artist-dashboard';
import {
  deactivatePlacementsForPlaylistRows,
  earliestObservationDate,
  earliestPlacementFirstSeenForPlaylist,
  syncPlacementsForArtistPlaylist,
} from '@/lib/playlist-placements';

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
        const snapshotFirstSeen =
          earliestObservationDate(
            playlist.parsedDate,
            ...artistTracks.map((t) => t.parsedDate),
            today
          ) || today

        if (existing) {
          // Проверяем, изменились ли треки
          const existingTracks = existing.trackData as unknown as ParsedTrack[];
          const tracksChanged = JSON.stringify(existingTracks) !== JSON.stringify(artistTracks);
          const shouldFillArtistId = !existing.artistId && !!artistId;
          const nextPlaylistFirstSeen =
            earliestObservationDate(existing.firstSeenDate, snapshotFirstSeen) ||
            existing.firstSeenDate ||
            snapshotFirstSeen
          const shouldBackfillFirstSeen =
            nextPlaylistFirstSeen !== (existing.firstSeenDate || null)

          if (
            tracksChanged ||
            existing.lastSeenDate !== today ||
            shouldFillArtistId ||
            shouldBackfillFirstSeen
          ) {
            const updatedPlaylist = await prisma.playlist.update({
              where: { id: existing.id },
              data: {
                trackData: artistTracks as any,
                lastSeenDate: today,
                updatedAt: new Date(),
                ...(shouldFillArtistId ? { artistId } : {}),
                ...(shouldBackfillFirstSeen
                  ? { firstSeenDate: nextPlaylistFirstSeen }
                  : {}),
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

            await enqueuePlacementMirrors({
              playlistUrl: playlist.playlistUrl,
              playlistName: playlist.playlistName,
              platform: playlist.platform,
              artistName,
              artistId,
              playlistRowId: updatedPlaylist.id,
              tracks: artistTracks,
              today,
              playlistFirstSeenDate: updatedPlaylist.firstSeenDate,
            })

            stats.updated++;
          } else {
            await enqueuePlacementMirrors({
              playlistUrl: playlist.playlistUrl,
              playlistName: playlist.playlistName,
              platform: playlist.platform,
              artistName,
              artistId,
              playlistRowId: existing.id,
              tracks: artistTracks,
              today,
              playlistFirstSeenDate: existing.firstSeenDate,
            })
            stats.unchanged++;
          }
        } else {
          // Recreate after cleanup: keep earliest placement/history age, not "today".
          const preservedFirstSeen = await earliestPlacementFirstSeenForPlaylist({
            playlistUrl: playlist.playlistUrl,
            artistName,
          })
          const firstSeenDate =
            earliestObservationDate(
              preservedFirstSeen,
              snapshotFirstSeen,
              today
            ) || today

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
              firstSeenDate,
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

          await enqueuePlacementMirrors({
            playlistUrl: playlist.playlistUrl,
            playlistName: playlist.playlistName,
            platform: playlist.platform,
            artistName,
            artistId,
            playlistRowId: createdPlaylist.id,
            tracks: artistTracks,
            today,
            playlistFirstSeenDate: createdPlaylist.firstSeenDate,
          })

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
 * Удаляет плейлист по его Postgres id (id, который отдаёт /api/playlists/sftp).
 * Возвращает false, если записи с таким id нет.
 */
export async function deletePlaylistById(id: string): Promise<boolean> {
  try {
    const row = await prisma.playlist.findUnique({
      where: { id },
      select: { id: true, playlistName: true },
    })
    const { count } = await prisma.playlist.deleteMany({ where: { id } });
    if (count > 0 && row) {
      try {
        const deactivated = await deactivatePlacementsForPlaylistRows([row.id])
        const { enqueuePlaylistSync } = await import("@/lib/buildin/sync-hooks")
        for (const p of deactivated) {
          await enqueuePlaylistSync({
            id: p.placementKey,
            trackTitle: p.trackTitle,
            artistName: p.artistName,
            playlistName: p.playlistName,
            playlistUrl: p.playlistUrl,
            firstSeenDate: p.firstSeenDate,
            archived: true,
          })
        }
      } catch (err) {
        console.error("Buildin playlist archive enqueue failed:", err)
      }
    }
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
  const rows = await prisma.playlist.findMany({ select: { id: true, playlistName: true } })
  const { count } = await prisma.playlist.deleteMany({});
  try {
    const deactivated = await deactivatePlacementsForPlaylistRows(rows.map((r) => r.id))
    // Also deactivate any orphans without playlistRowId
    const orphans = await prisma.playlistTrackPlacement.findMany({
      where: { isActive: true },
    })
    const today = mskDateString()
    if (orphans.length > 0) {
      await prisma.playlistTrackPlacement.updateMany({
        where: { isActive: true },
        data: { isActive: false, lastSeenDate: today },
      })
    }
    const { enqueuePlaylistSync } = await import("@/lib/buildin/sync-hooks")
    const toArchive = [
      ...deactivated,
      ...orphans.filter((o) => !deactivated.some((d) => d.id === o.id)),
    ]
    for (const p of toArchive) {
      await enqueuePlaylistSync({
        id: p.placementKey,
        trackTitle: p.trackTitle,
        artistName: p.artistName,
        playlistName: p.playlistName,
        playlistUrl: p.playlistUrl,
        firstSeenDate: p.firstSeenDate,
        archived: true,
      })
    }
  } catch (err) {
    console.error("Buildin playlist archive enqueue failed:", err)
  }
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

    try {
      const updated = await prisma.playlist.findMany({
        where: { id: { in: playlists.map((p) => p.id) } },
      })
      for (const pl of updated) {
        const tracks = (pl.trackData as unknown as ParsedTrack[]) || []
        await enqueuePlacementMirrors({
          playlistUrl: pl.playlistUrl,
          playlistName: pl.playlistName,
          platform: pl.platform,
          artistName: pl.artistName,
          artistId: pl.artistId,
          playlistRowId: pl.id,
          tracks,
          today: mskDateString(),
          playlistFirstSeenDate: pl.firstSeenDate,
        })
      }
    } catch (err) {
      console.error("Buildin playlist assign sync enqueue failed:", err)
    }
    
    return playlists.length;
  } catch (error) {
    console.error('❌ Ошибка назначения плейлистов артисту:', error);
    return 0;
  }
}

export type ManualAssignResult =
  | { status: 'assigned'; previousArtistId: string | null }
  | { status: 'unchanged'; previousArtistId: string }
  | { status: 'not_found' }
  | { status: 'needs_confirmation'; previousArtistId: string }
  | { status: 'error'; message: string }

/**
 * Вручную назначает конкретный плейлист артисту.
 *
 * H3: раньше функция всегда делала update и возвращала true — переназначение
 * молча забирало плейлист у другого артиста (он терял видимость без всякого
 * предупреждения), а ветка «already assigned» в роуте была недостижима.
 * Теперь смена владельца требует явного `force`.
 */
export async function assignPlaylistToArtistManually(
  playlistId: string,
  artistId: string,
  options?: { force?: boolean }
): Promise<ManualAssignResult> {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true, artistId: true },
    });

    if (!playlist) {
      return { status: 'not_found' };
    }

    if (playlist.artistId === artistId) {
      return { status: 'unchanged', previousArtistId: artistId };
    }

    if (playlist.artistId && !options?.force) {
      return { status: 'needs_confirmation', previousArtistId: playlist.artistId };
    }

    await prisma.playlist.update({
      where: { id: playlistId },
      data: { artistId }
    });

    try {
      const full = await prisma.playlist.findUnique({ where: { id: playlistId } })
      if (full) {
        const tracks = (full.trackData as unknown as ParsedTrack[]) || []
        await enqueuePlacementMirrors({
          playlistUrl: full.playlistUrl,
          playlistName: full.playlistName,
          platform: full.platform,
          artistName: full.artistName,
          artistId: full.artistId,
          playlistRowId: full.id,
          tracks,
          today: mskDateString(),
          playlistFirstSeenDate: full.firstSeenDate,
        })
      }
    } catch (err) {
      console.error("Buildin playlist manual assign sync failed:", err)
    }

    return { status: 'assigned', previousArtistId: playlist.artistId };
  } catch (error) {
    console.error('❌ Ошибка ручного назначения плейлиста:', error);
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

async function enqueuePlacementMirrors(opts: {
  playlistUrl: string
  playlistName: string
  platform: string
  artistName: string
  artistId?: string | null
  playlistRowId: string
  tracks: ParsedTrack[]
  today: string
  playlistFirstSeenDate?: string | null
}) {
  try {
    const { upserted, deactivated } = await syncPlacementsForArtistPlaylist(opts)
    const { enqueuePlaylistSync } = await import("@/lib/buildin/sync-hooks")
    for (const p of upserted) {
      if (!p.changed) continue
      await enqueuePlaylistSync({
        id: p.placementKey,
        trackTitle: p.trackTitle,
        artistName: p.artistName,
        playlistName: p.playlistName,
        playlistUrl: p.playlistUrl,
        firstSeenDate: p.firstSeenDate,
      })
    }
    for (const p of deactivated) {
      await enqueuePlaylistSync({
        id: p.placementKey,
        trackTitle: p.trackTitle,
        artistName: p.artistName,
        playlistName: p.playlistName,
        playlistUrl: p.playlistUrl,
        firstSeenDate: p.firstSeenDate,
        archived: true,
      })
    }
  } catch (err) {
    console.error("Buildin playlist placement sync failed:", err)
  }
}
