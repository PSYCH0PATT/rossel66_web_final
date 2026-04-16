import * as path from "path"
import { processCsvFiles } from "@/lib/sftp-playlist-parser"
import { savePlaylists } from "@/lib/sftp-playlist-storage"
import { cleanupRemovedPlaylists } from "@/lib/playlist-history"
import { markFileAsProcessed } from "@/lib/sftp-playlist-sync"
import { addActivity } from "@/lib/storage"

export type PlaylistImportResult = {
  success: boolean
  filename: string
  playlistsParsed: number
  added: number
  updated: number
  unchanged: number
  removed: number
  errors: string[]
}

/**
 * Парсит CSV, сохраняет плейлисты в БД, опционально удаляет записи, которых нет в этом снимке.
 */
export async function importPlaylistsFromCsvFile(
  absolutePath: string,
  options: {
    cleanupRemoved: boolean
    /** Вызвать markFileAsProcessed для basename (индекс SFTP) */
    markProcessedInIndex: boolean
  }
): Promise<PlaylistImportResult> {
  const filename = path.basename(absolutePath)
  const errors: string[] = []

  let playlists: ReturnType<typeof processCsvFiles> = []
  try {
    playlists = processCsvFiles([absolutePath])
  } catch (e: any) {
    return {
      success: false,
      filename,
      playlistsParsed: 0,
      added: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      errors: [e?.message || String(e)],
    }
  }

  const saveResult = await savePlaylists(playlists)
  if (saveResult.errors.length) {
    errors.push(...saveResult.errors)
  }

  const currentPlaylistKeys = new Set<string>()
  playlists.forEach((p) => {
    currentPlaylistKeys.add(`${p.playlistUrl}|${p.playlistName}`)
  })

  let removed = 0
  if (options.cleanupRemoved && currentPlaylistKeys.size > 0) {
    const cleanup = await cleanupRemovedPlaylists(currentPlaylistKeys)
    removed = cleanup.removed
    if (cleanup.errors.length) errors.push(...cleanup.errors)
  }

  if (options.markProcessedInIndex) {
    markFileAsProcessed(filename)
  }

  if (saveResult.added > 0 && saveResult.addedPlaylists.length > 0) {
    try {
      for (const added of saveResult.addedPlaylists) {
        if (added.artistId) {
          await addActivity({
            type: "playlist_found",
            userId: added.artistId,
            userRole: "artist",
            title: "Добавлен плейлист",
            description: `Добавлен плейлист «${added.playlistName}»`,
            metadata: {
              playlistName: added.playlistName,
              artistName: added.artistName,
              source: "sftp",
            },
          })
        }
        await addActivity({
          type: "playlist_found",
          userId: "system",
          userRole: "admin",
          title: "Добавлен плейлист",
          description: `Добавлен плейлист «${added.playlistName}» (артист: ${added.artistName})`,
          metadata: {
            playlistName: added.playlistName,
            artistName: added.artistName,
            artistId: added.artistId,
            source: "sftp",
          },
        })
      }
    } catch (e: any) {
      console.warn("playlist import: уведомления activity:", e)
    }
  }

  return {
    success: errors.length === 0,
    filename,
    playlistsParsed: playlists.length,
    added: saveResult.added,
    updated: saveResult.updated,
    unchanged: saveResult.unchanged,
    removed,
    errors,
  }
}
