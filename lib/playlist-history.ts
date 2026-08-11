import { prisma } from "./prisma"
import { mskDateString } from "@/lib/msk-date"
import { enqueuePlaylistHistorySync } from "@/lib/buildin/sync-hooks"
import { deactivatePlacementsForPlaylistRows } from "@/lib/playlist-placements"
import type { Prisma } from "@prisma/client"

export interface PlaylistHistoryRecord {
  playlistUrl: string
  playlistName: string
  platform: string
  changeType: "added" | "updated" | "removed" | "position_changed"
  changeDate: string
  artistName?: string
  artistId?: string | null
  trackTitle?: string
  oldPosition?: number
  newPosition?: number
  metadata?: Record<string, unknown>
}

/**
 * Persist a playlist change event and optionally mirror to Buildin.
 */
export async function recordPlaylistChange(record: PlaylistHistoryRecord): Promise<void> {
  try {
    const row = await prisma.playlistHistory.create({
      data: {
        playlistUrl: record.playlistUrl,
        playlistName: record.playlistName,
        platform: record.platform,
        changeType: record.changeType,
        changeDate: record.changeDate,
        artistName: record.artistName ?? null,
        artistId: record.artistId ?? null,
        trackTitle: record.trackTitle ?? null,
        oldPosition: record.oldPosition ?? null,
        newPosition: record.newPosition ?? null,
        metadata: (record.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    })

    await enqueuePlaylistHistorySync({
      id: row.id,
      playlistName: row.playlistName,
      playlistUrl: row.playlistUrl,
      platform: row.platform,
      changeType: row.changeType,
      changeDate: row.changeDate,
      artistName: row.artistName,
      trackTitle: row.trackTitle,
    })
  } catch (err) {
    console.error("recordPlaylistChange failed:", err)
  }
}

/**
 * Query playlist change history from Postgres.
 */
export async function getPlaylistHistory(filters?: {
  startDate?: string
  endDate?: string
  changeType?: string
  artistName?: string
  playlistUrl?: string
  limit?: number
}): Promise<
  Array<{
    id: string
    playlistUrl: string
    playlistName: string
    platform: string
    changeType: string
    changeDate: string
    artistName: string | null
    artistId: string | null
    trackTitle: string | null
    oldPosition: number | null
    newPosition: number | null
    createdAt: Date
  }>
> {
  const where: Record<string, unknown> = {}

  if (filters?.changeType) where.changeType = filters.changeType
  if (filters?.playlistUrl) where.playlistUrl = filters.playlistUrl
  if (filters?.artistName) {
    where.artistName = { contains: filters.artistName, mode: "insensitive" }
  }
  if (filters?.startDate || filters?.endDate) {
    where.changeDate = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    }
  }

  return prisma.playlistHistory.findMany({
    where,
    orderBy: [{ changeDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(filters?.limit ?? 200, 1000),
  })
}

/**
 * Removes playlists missing from the current SFTP snapshot.
 */
export async function cleanupRemovedPlaylists(
  currentPlaylistKeys: Set<string>
): Promise<{ removed: number; errors: string[] }> {
  const result = { removed: 0, errors: [] as string[] }

  if (currentPlaylistKeys.size === 0) {
    console.warn(
      "⚠️  cleanupRemovedPlaylists: пропуск — пустой набор ключей (иначе удалились бы все плейлисты в БД)"
    )
    return result
  }

  try {
    const allPlaylists = await prisma.playlist.findMany({
      select: {
        id: true,
        playlistUrl: true,
        playlistName: true,
        platform: true,
        artistName: true,
        artistId: true,
      },
    })

    const now = mskDateString() // A5: МСК-дата

    for (const playlist of allPlaylists) {
      const key = `${playlist.playlistUrl}|${playlist.playlistName}`

      if (!currentPlaylistKeys.has(key)) {
        try {
          await recordPlaylistChange({
            playlistUrl: playlist.playlistUrl,
            playlistName: playlist.playlistName,
            platform: playlist.platform,
            changeType: "removed",
            changeDate: now,
            artistName: playlist.artistName ?? undefined,
            artistId: playlist.artistId,
          })

          const deactivated = await deactivatePlacementsForPlaylistRows([
            playlist.id,
          ])
          try {
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
            console.error("Buildin placement archive on cleanup failed:", err)
          }

          await prisma.playlist.delete({ where: { id: playlist.id } })
          result.removed++
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          result.errors.push(
            `Ошибка удаления плейлиста ${playlist.playlistName} (${playlist.artistName}): ${message}`
          )
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    result.errors.push(`Ошибка получения плейлистов для очистки: ${message}`)
  }

  return result
}
