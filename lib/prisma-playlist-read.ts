/**
 * Безопасное чтение Playlist: если в БД ещё нет колонок coverUrl/coverFetchedAt
 * (миграция не применена), повторяем запрос без этих полей вместо «тихого» [].
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const PLAYLIST_LIST_SELECT_LEGACY = {
  id: true,
  playlistUrl: true,
  playlistName: true,
  platform: true,
  artistName: true,
  artistId: true,
  trackData: true,
  firstSeenDate: true,
  lastSeenDate: true,
  createdAt: true,
  updatedAt: true,
} as const

export const PLAYLIST_LIST_SELECT_WITH_COVER = {
  ...PLAYLIST_LIST_SELECT_LEGACY,
  coverUrl: true,
  coverFetchedAt: true,
} as const

export type PlaylistListRow = Prisma.PlaylistGetPayload<{
  select: typeof PLAYLIST_LIST_SELECT_WITH_COVER
}>

export function isPlaylistCoverColumnError(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e)
  if (m.includes('coverUrl') || m.includes('coverFetchedAt')) return true
  if (/column .* does not exist/i.test(m) && /cover/i.test(m)) return true
  return false
}

/**
 * findMany без `select` в args.
 *
 * Сначала читаем с coverUrl/coverFetchedAt. Любая ошибка на этом шаге → повтор **без**
 * этих колонок (миграция не накатана, другое имя колонки в БД, transient от пула и т.д.).
 * Так список плейлистов не пропадает из‑за того, что в схему добавили поле обложки.
 */
export async function findManyPlaylistRows(
  args: Omit<Prisma.PlaylistFindManyArgs, 'select'>
): Promise<PlaylistListRow[]> {
  try {
    return await prisma.playlist.findMany({
      ...args,
      select: PLAYLIST_LIST_SELECT_WITH_COVER,
    })
  } catch (e) {
    const hint =
      isPlaylistCoverColumnError(e)
        ? 'Похоже, в БД нет колонок cover — выполните: npx prisma migrate deploy'
        : 'Повторный запрос без полей cover (первая попытка упала)'
    console.warn(`[Playlist] ${hint}`, e)
    try {
      const rows = await prisma.playlist.findMany({
        ...args,
        select: PLAYLIST_LIST_SELECT_LEGACY,
      })
      return rows.map((r) => ({
        ...r,
        coverUrl: null,
        coverFetchedAt: null,
      }))
    } catch (e2) {
      console.error('[Playlist] Повторный findMany без cover тоже упал:', e2)
      throw e2
    }
  }
}
