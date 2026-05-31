import type { ParsedPlaylist, ParsedTrack } from "@/lib/sftp-playlist-parser"
import { savePlaylists } from "@/lib/sftp-playlist-storage"

type BandlinkSqliteRow = {
  artist_name?: string
  playlist_name?: string
  playlist_url?: string
  platform?: string
  track_names?: string
  parsed_at?: string
  added_at?: string
}

type VkSqliteRow = {
  artist_name?: string
  playlist_name?: string
  playlist_url?: string
  playlist_cover_url?: string
  parsed_at?: string
}

function stubTrack(artistName: string, label: string, parsedDate: string): ParsedTrack {
  const titleArtist = `${artistName} - ${label}`
  return {
    titleArtist,
    trackTitle: label,
    artistName,
    artistId: null,
    position: 1,
    isrc: "",
    releaseDate: "",
    parsedDate: parsedDate || new Date().toISOString().split("T")[0],
    albumTitle: "",
  }
}

function bandlinkRowToPlaylist(row: BandlinkSqliteRow): ParsedPlaylist | null {
  const artistName = row.artist_name?.trim()
  const playlistName = row.playlist_name?.trim()
  const playlistUrl = row.playlist_url?.trim()
  if (!artistName || !playlistName || !playlistUrl) return null

  const parsedDate =
    (row.parsed_at || row.added_at || new Date().toISOString()).toString().split("T")[0]
  const trackLabel = row.track_names?.trim() || playlistName

  return {
    playlistUrl,
    playlistName,
    platform: row.platform?.trim() || "Bandlink",
    parsedDate,
    tracks: [stubTrack(artistName, trackLabel, parsedDate)],
  }
}

function vkRowToPlaylist(row: VkSqliteRow): ParsedPlaylist | null {
  const artistName = row.artist_name?.trim()
  const playlistName = row.playlist_name?.trim()
  const playlistUrl = row.playlist_url?.trim()
  if (!artistName || !playlistName || !playlistUrl) return null

  const parsedDate = (row.parsed_at || new Date().toISOString()).toString().split("T")[0]

  return {
    playlistUrl,
    playlistName,
    platform: "VK Музыка",
    parsedDate,
    tracks: [stubTrack(artistName, playlistName, parsedDate)],
  }
}

export async function syncBandlinkSqliteRowsToPostgres(rows: BandlinkSqliteRow[]) {
  const playlists = rows.map(bandlinkRowToPlaylist).filter((p): p is ParsedPlaylist => p !== null)
  if (playlists.length === 0) return { added: 0, updated: 0, unchanged: 0 }
  return savePlaylists(playlists)
}

export async function syncVkSqliteRowsToPostgres(rows: VkSqliteRow[]) {
  const playlists = rows.map(vkRowToPlaylist).filter((p): p is ParsedPlaylist => p !== null)
  if (playlists.length === 0) return { added: 0, updated: 0, unchanged: 0 }
  return savePlaylists(playlists)
}
