import { NextRequest, NextResponse } from 'next/server';
import { getAllPlaylists, getPlaylistsByArtist } from '@/lib/sftp-playlist-storage';
import { getPlaylistCoverUrl } from '@/lib/playlist-cover';

/**
 * GET /api/playlists/sftp
 * Получает плейлисты из SFTP источника
 * 
 * Query параметры:
 * - artistName: фильтр по имени артиста (опционально)
 */
export async function GET(request: NextRequest) {
  try {
    const artistName = request.nextUrl.searchParams.get('artistName');
    
    let playlists;
    if (artistName) {
      playlists = await getPlaylistsByArtist(artistName);
    } else {
      playlists = await getAllPlaylists();
    }
    
    // Преобразуем в формат, совместимый с существующим API
    const formattedPlaylists = playlists.map((playlist: any) => {
      // Группируем треки по артистам для отображения
      const tracksByArtist = new Map<string, any[]>();
      const tracks = JSON.parse(playlist.track_data || '[]');
      
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
      
      // Формируем результат (обложка по платформе — в таблицах с SFTP нет ссылок на картинки)
      const result: any = {
        id: playlist.id,
        playlist_name: playlist.playlist_name,
        playlist_url: playlist.playlist_url,
        platform: playlist.platform,
        playlist_cover_url: getPlaylistCoverUrl(playlist.platform),
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
      
      // Если несколько треков одного артиста, добавляем информацию
      if (maxTracks > 1) {
        result.tracks_info = artistTracks.map((t: any) => ({
          title: t.titleArtist, // Название трека
          releaseName: t.albumTitle || t.titleArtist, // Название релиза (альбома)
          position: t.position, // Позиция в плейлисте
          isrc: t.isrc
        }));
      } else if (artistTracks.length > 0) {
        // Даже если один трек, добавляем информацию о позиции
        result.tracks_info = artistTracks.map((t: any) => ({
          title: t.titleArtist,
          releaseName: t.albumTitle || t.titleArtist,
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
      
      // Добавляем список названий релизов ТОЛЬКО для этого артиста
      const uniqueReleases = new Set<string>();
      artistTracks.forEach((t: any) => {
        if (t.albumTitle) {
          uniqueReleases.add(t.albumTitle);
        }
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
      
      return result;
    });
    
    return NextResponse.json({
      success: true,
      results: formattedPlaylists,
      count: formattedPlaylists.length
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
