import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAllPlaylists, getPlaylistsByArtist, getPlaylistsByArtistId } from '@/lib/sftp-playlist-storage';
import { getPlaylistCoverUrl } from '@/lib/playlist-cover';
import { extractTrackTitle } from '@/lib/sftp-playlist-parser';
import { requireAdmin } from '@/lib/server-auth';
import { jsonWithPerfLog } from '@/lib/api-perf-log';

export const dynamic = "force-dynamic"

const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * GET /api/playlists/sftp
 * Получает плейлисты из SFTP источника
 *
 * Query параметры:
 * - artistId: фильтр по ID артиста (опционально)
 * - artistName: фильтр по имени артиста (опционально)
 */
export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const pathname = request.nextUrl.pathname;

  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const sp = request.nextUrl.searchParams;
    const artistId = sp.get('artistId');
    const artistName = sp.get('artistName');
    const q = sp.get('q')?.trim() || undefined;
    const platform = sp.get('platform')?.trim() || undefined;
    const take = Math.min(
      Math.max(1, Number(sp.get('take') || String(DEFAULT_TAKE)) || DEFAULT_TAKE),
      MAX_TAKE
    );
    const skip = Math.max(0, Number(sp.get('skip') || '0') || 0);

    let playlists;
    let total: number | undefined;

    if (artistId) {
      playlists = await getPlaylistsByArtistId(artistId);
      if (q) {
        const ql = q.toLowerCase();
        playlists = playlists.filter(
          (p) =>
            (p.playlist_name || '').toLowerCase().includes(ql) ||
            (p.artist_name || '').toLowerCase().includes(ql)
        );
      }
      if (platform) {
        const pl = platform.toLowerCase();
        playlists = playlists.filter((p) => (p.platform || '').toLowerCase().includes(pl));
      }
      total = playlists.length;
      playlists = playlists.slice(skip, skip + take);
    } else if (artistName) {
      playlists = await getPlaylistsByArtist(artistName);
      if (q) {
        const ql = q.toLowerCase();
        playlists = playlists.filter((p) =>
          (p.playlist_name || '').toLowerCase().includes(ql)
        );
      }
      total = playlists.length;
      playlists = playlists.slice(skip, skip + take);
    } else {
      const where: Prisma.PlaylistWhereInput = {};
      if (q) {
        where.OR = [
          { playlistName: { contains: q, mode: 'insensitive' } },
          { artistName: { contains: q, mode: 'insensitive' } },
        ];
      }
      if (platform) {
        where.platform = { contains: platform, mode: 'insensitive' };
      }
      [total, playlists] = await Promise.all([
        prisma.playlist.count({ where }),
        getAllPlaylists({ take, skip, where }),
      ]);
    }

    // Преобразуем в формат, совместимый с существующим API
    const formattedPlaylists = playlists.flatMap((playlist: any) => {
      try {
      // Группируем треки по артистам для отображения
      const tracksByArtist = new Map<string, any[]>();
      let tracks: any[] = []
      try {
        const raw = playlist.track_data || "[]"
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
        tracks = Array.isArray(parsed) ? parsed : []
      } catch {
        tracks = []
      }

      tracks.forEach((track: any) => {
        const artistKey = track.artistName || 'Unknown';
        if (!tracksByArtist.has(artistKey)) {
          tracksByArtist.set(artistKey, []);
        }
        tracksByArtist.get(artistKey)!.push(track);
      });

      // Подсчитываем треки по артистам
      const tracksByArtistCount = new Map<string, number>();
      tracks.forEach((t: any) => {
        const artistKey = t.artistName || 'Unknown';
        tracksByArtistCount.set(artistKey, (tracksByArtistCount.get(artistKey) || 0) + 1);
      });

      // Определяем основной артист (с наибольшим количеством треков)
      let mainArtistName = playlist.artist_name || '';
      let maxTracks = 0;
      for (const [artistName, count] of tracksByArtistCount.entries()) {
        if (count > maxTracks) {
          maxTracks = count;
          mainArtistName = artistName;
        }
      }

      // Формируем результат (обложка: реальная из БД или фоллбэк по платформе)
      const result: any = {
        id: playlist.id,
        playlist_name: playlist.playlist_name,
        playlist_url: playlist.playlist_url,
        platform: playlist.platform,
        playlist_cover_url: getPlaylistCoverUrl(playlist.platform, playlist.cover_url ?? null),
        artist_name: mainArtistName,
        artist_id: playlist.artist_id,
        parsed_at: playlist.last_seen_date,
        added_at: playlist.first_seen_date,
        tracks_count: tracks.length,
        tracks_by_artist: Object.fromEntries(tracksByArtist),
        multiple_tracks: maxTracks > 1
      };

      // Находим треки этого артиста для определения позиции
      const artistTracks = tracks.filter((t: any) => t.artistName === mainArtistName);

      // Название трека: из поля trackTitle или извлекаем из title_artist (для старых записей в БД)
      const getTrackDisplayName = (t: any) => t.trackTitle ?? (t.titleArtist ? extractTrackTitle(t.titleArtist) : null) ?? t.titleArtist;

      if (maxTracks > 1) {
        result.tracks_info = artistTracks.map((t: any) => ({
          title: getTrackDisplayName(t),
          releaseName: t.albumTitle || getTrackDisplayName(t) || t.titleArtist,
          position: t.position,
          isrc: t.isrc
        }));
      } else if (artistTracks.length > 0) {
        result.tracks_info = artistTracks.map((t: any) => ({
          title: getTrackDisplayName(t),
          releaseName: t.albumTitle || getTrackDisplayName(t) || t.titleArtist,
          position: t.position,
          isrc: t.isrc
        }));
      }

      // Добавляем позицию трека (минимальная позиция треков этого артиста)
      if (artistTracks.length > 0) {
        const positions = artistTracks.map((t: any) => t.position).filter((p: number) => p != null && !isNaN(p));
        if (positions.length > 0) {
          result.track_position = Math.min(...positions);
        }
      }

      // Список названий треков для блока «Релизы» (как в Yandex Lens — извлечённое название трека)
      const uniqueReleases = new Set<string>();
      artistTracks.forEach((t: any) => {
        const name = getTrackDisplayName(t);
        if (name) uniqueReleases.add(name);
      });
      result.release_names = Array.from(uniqueReleases);

      // Убеждаемся, что tracks_info содержит только треки этого артиста
      if (result.tracks_info) {
        result.tracks_info = result.tracks_info.filter((t: any) => {
          // Проверяем, что трек принадлежит основному артисту
          const trackArtist = tracks.find((tr: any) => tr.titleArtist === t.title || tr.albumTitle === t.releaseName);
          return trackArtist && trackArtist.artistName === mainArtistName;
        });
      }

      return [result]
      } catch (rowErr) {
        console.error("Ошибка форматирования плейлиста", playlist?.id, rowErr)
        return [
          {
            id: playlist?.id,
            playlist_name: playlist?.playlist_name ?? "—",
            playlist_url: playlist?.playlist_url ?? "",
            platform: playlist?.platform ?? "",
            playlist_cover_url: getPlaylistCoverUrl(playlist?.platform, playlist?.cover_url ?? null),
            artist_name: playlist?.artist_name ?? "",
            artist_id: playlist?.artist_id ?? null,
            parsed_at: playlist?.last_seen_date,
            added_at: playlist?.first_seen_date,
            tracks_count: 0,
            tracks_by_artist: {},
            multiple_tracks: false,
          },
        ]
      }
    });

    // Для artistId убираем дубликаты по одному и тому же плейлисту (url + название)
    let results = formattedPlaylists;
    if (artistId) {
      const seen = new Set<string>();
      results = formattedPlaylists.filter((p: any) => {
        const url = (p.playlist_url ?? '').trim().replace(/\/+$/, '');
        const name = (p.playlist_name ?? '').trim().toLowerCase();
        const key = `${url}|${name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return jsonWithPerfLog(pathname, startedAt, {
      success: true,
      results,
      count: results.length,
      total: total ?? results.length,
      take,
      skip,
      ...(artistId || artistName ? {} : { paginated: true }),
    });

  } catch (error) {
    console.error('Ошибка получения плейлистов из SFTP:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error)
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';
