import type { ParsedPlaylist as SftpParsedPlaylist } from "@/lib/sftp-playlist-parser"
import { savePlaylists } from "@/lib/sftp-playlist-storage"
import type { ParsedPlaylist as VkHtmlPlaylist } from "@/lib/vk-parser"

export async function persistVkHtmlPlaylistsForArtist(
  artistId: string,
  artistName: string,
  playlists: VkHtmlPlaylist[]
): Promise<{ added: number; updated: number; unchanged: number }> {
  const parsedDate = new Date().toISOString().split("T")[0]
  const toSave: SftpParsedPlaylist[] = playlists.map((p) => ({
    playlistUrl: p.playlistUrl,
    playlistName: p.name,
    platform: "VK Музыка",
    parsedDate,
    tracks: [
      {
        titleArtist: `${artistName} - ${p.name}`,
        trackTitle: p.name,
        artistName,
        artistId,
        position: 1,
        isrc: "",
        releaseDate: "",
        parsedDate,
        albumTitle: "",
      },
    ],
  }))

  const stats = await savePlaylists(toSave)
  return {
    added: stats.added,
    updated: stats.updated,
    unchanged: stats.unchanged,
  }
}
