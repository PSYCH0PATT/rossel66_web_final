import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  getAllPlaylists,
  getPlaylistsByArtist,
  getPlaylistsByArtistId,
} from '@/lib/sftp-playlist-storage'
import { getPlaylistCoverUrl } from '@/lib/playlist-cover'
import { extractTrackTitle } from '@/lib/sftp-playlist-parser'

/**
 * Загрузка и форматирование плейлистов для API `/api/playlists/sftp`.
 *
 * Вынесено из роута, чтобы серверный код (парсеры VK/Bandlink) вызывал это
 * напрямую вместо self-fetch'а: роут закрыт `requireAdmin`, а парсеры ходили
 * с cron-Bearer → всегда 401 → вкладки «Результаты» были молча пустыми
 * (F-PARS-4).
 */

export const DEFAULT_TAKE = 100
export const MAX_TAKE = 500

export type SftpPlaylistQuery = {
  artistId?: string | null
  artistName?: string | null
  q?: string | null
  platform?: string | null
  take?: number
  skip?: number
}

export type SftpPlaylistsResult = {
  results: any[]
  count: number
  total: number
  take: number
  skip: number
  paginated: boolean
}

function formatPlaylist(playlist: any): any {
  try {
    // Группируем треки по артистам для отображения
    const tracksByArtist = new Map<string, any[]>()
    let tracks: any[] = []
    try {
      const raw = playlist.track_data || '[]'
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      tracks = Array.isArray(parsed) ? parsed : []
    } catch {
      tracks = []
    }

    tracks.forEach((track: any) => {
      const artistKey = track.artistName || 'Unknown'
      if (!tracksByArtist.has(artistKey)) {
        tracksByArtist.set(artistKey, [])
      }
      tracksByArtist.get(artistKey)!.push(track)
    })

    // Подсчитываем треки по артистам
    const tracksByArtistCount = new Map<string, number>()
    tracks.forEach((t: any) => {
      const artistKey = t.artistName || 'Unknown'
      tracksByArtistCount.set(artistKey, (tracksByArtistCount.get(artistKey) || 0) + 1)
    })

    // Определяем основного артиста (с наибольшим количеством треков)
    let mainArtistName = playlist.artist_name || ''
    let maxTracks = 0
    for (const [artistName, count] of tracksByArtistCount.entries()) {
      if (count > maxTracks) {
        maxTracks = count
        mainArtistName = artistName
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
      multiple_tracks: maxTracks > 1,
    }

    // Находим треки этого артиста для определения позиции
    const artistTracks = tracks.filter((t: any) => t.artistName === mainArtistName)

    // Название трека: из поля trackTitle или извлекаем из title_artist (для старых записей в БД)
    const getTrackDisplayName = (t: any) =>
      t.trackTitle ?? (t.titleArtist ? extractTrackTitle(t.titleArtist) : null) ?? t.titleArtist

    if (artistTracks.length > 0) {
      result.tracks_info = artistTracks.map((t: any) => ({
        title: getTrackDisplayName(t),
        releaseName: t.albumTitle || getTrackDisplayName(t) || t.titleArtist,
        position: t.position,
        isrc: t.isrc,
      }))
    }

    // Добавляем позицию трека (минимальная позиция треков этого артиста)
    if (artistTracks.length > 0) {
      const positions = artistTracks
        .map((t: any) => t.position)
        .filter((p: number) => p != null && !isNaN(p))
      if (positions.length > 0) {
        result.track_position = Math.min(...positions)
      }
    }

    // Список названий треков для блока «Релизы» (как в Yandex Lens — извлечённое название трека)
    const uniqueReleases = new Set<string>()
    artistTracks.forEach((t: any) => {
      const name = getTrackDisplayName(t)
      if (name) uniqueReleases.add(name)
    })
    result.release_names = Array.from(uniqueReleases)

    return result
  } catch (rowErr) {
    console.error('Ошибка форматирования плейлиста', playlist?.id, rowErr)
    return {
      id: playlist?.id,
      playlist_name: playlist?.playlist_name ?? '—',
      playlist_url: playlist?.playlist_url ?? '',
      platform: playlist?.platform ?? '',
      playlist_cover_url: getPlaylistCoverUrl(playlist?.platform, playlist?.cover_url ?? null),
      artist_name: playlist?.artist_name ?? '',
      artist_id: playlist?.artist_id ?? null,
      parsed_at: playlist?.last_seen_date,
      added_at: playlist?.first_seen_date,
      tracks_count: 0,
      tracks_by_artist: {},
      multiple_tracks: false,
    }
  }
}

export async function loadFormattedSftpPlaylists(
  query: SftpPlaylistQuery = {}
): Promise<SftpPlaylistsResult> {
  const artistId = query.artistId || null
  const artistName = query.artistName || null
  const q = query.q?.trim() || undefined
  const platform = query.platform?.trim() || undefined
  const take = Math.min(Math.max(1, query.take || DEFAULT_TAKE), MAX_TAKE)
  const skip = Math.max(0, query.skip || 0)

  let playlists: any[]
  let total: number | undefined

  if (artistId) {
    playlists = await getPlaylistsByArtistId(artistId)
    if (q) {
      const ql = q.toLowerCase()
      playlists = playlists.filter(
        (p) =>
          (p.playlist_name || '').toLowerCase().includes(ql) ||
          (p.artist_name || '').toLowerCase().includes(ql)
      )
    }
    if (platform) {
      const pl = platform.toLowerCase()
      playlists = playlists.filter((p) => (p.platform || '').toLowerCase().includes(pl))
    }
    total = playlists.length
    playlists = playlists.slice(skip, skip + take)
  } else if (artistName) {
    playlists = await getPlaylistsByArtist(artistName)
    if (q) {
      const ql = q.toLowerCase()
      playlists = playlists.filter((p) => (p.playlist_name || '').toLowerCase().includes(ql))
    }
    total = playlists.length
    playlists = playlists.slice(skip, skip + take)
  } else {
    const where: Prisma.PlaylistWhereInput = {}
    if (q) {
      where.OR = [
        { playlistName: { contains: q, mode: 'insensitive' } },
        { artistName: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (platform) {
      where.platform = { contains: platform, mode: 'insensitive' }
    }
    const [countResult, rows] = await Promise.all([
      prisma.playlist.count({ where }),
      getAllPlaylists({ take, skip, where }),
    ])
    total = countResult
    playlists = rows as any[]
  }

  const formatted = playlists.map(formatPlaylist)

  // Для artistId убираем дубликаты по одному и тому же плейлисту (url + название)
  let results = formatted
  if (artistId) {
    const seen = new Set<string>()
    results = formatted.filter((p: any) => {
      const url = (p.playlist_url ?? '').trim().replace(/\/+$/, '')
      const name = (p.playlist_name ?? '').trim().toLowerCase()
      const key = `${url}|${name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  return {
    results,
    count: results.length,
    total: total ?? results.length,
    take,
    skip,
    paginated: !artistId && !artistName,
  }
}
