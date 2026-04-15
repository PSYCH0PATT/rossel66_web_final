import { normalizeArtistName } from "@/lib/storage"

/** Разделители фичерингов / коллабов в поле артиста плейлиста (как в CSV). */
const COLLAB_SPLIT = /\s*(?:,|&|\/|\+|\s+(?:feat|ft)\.?\s+)\s*/i
const AND_SPLIT = /\s+(?:и|and)\s+/i

export function tokenizeCollaborationArtistField(raw: string): string[] {
  const s = raw.trim()
  if (!s) return []
  const set = new Set<string>()
  set.add(normalizeArtistName(s))
  for (const piece of s.split(COLLAB_SPLIT)) {
    for (const sub of piece.split(AND_SPLIT)) {
      const n = normalizeArtistName(sub)
      if (n) set.add(n)
    }
  }
  return [...set]
}

/**
 * Строка плейлиста (artistName + artistId) видна этому артисту в кабинете:
 * — явно привязана по artistId;
 * — или не привязана (null), но ник/имя совпадает с полем артиста или сегментом коллаба.
 */
export function playlistRowVisibleToCabinetUser(
  row: { artistName: string; artistId: string | null },
  userId: string,
  displayName: string,
  username: string
): boolean {
  if (row.artistId === userId) return true
  if (row.artistId != null) return false

  const normDisplay = normalizeArtistName(displayName || "")
  const normUser = normalizeArtistName(username || "")
  const norms = new Set<string>()
  if (normDisplay) norms.add(normDisplay)
  if (normUser) norms.add(normUser)

  for (const t of tokenizeCollaborationArtistField(row.artistName)) {
    if (norms.has(t)) return true
  }
  return false
}

type UrlNameRow = {
  id: string
  playlistUrl: string
  playlistName: string
  artistId: string | null
  updatedAt: Date
  trackData?: unknown
}

function trackDataLength(row: UrlNameRow): number {
  const td = row.trackData
  return Array.isArray(td) ? td.length : 0
}

/** Одна карточка на плейлист: приоритет привязки по artistId, затем строка с большим числом треков. */
export function dedupePlaylistsByUrlAndName<T extends UrlNameRow>(rows: T[], userId: string): T[] {
  const key = (r: T) => `${r.playlistUrl}\u0000${r.playlistName}`
  const map = new Map<string, T>()
  const score = (x: T) => (x.artistId === userId ? 2 : x.artistId ? 1 : 0)

  for (const r of rows) {
    const k = key(r)
    const prev = map.get(k)
    if (!prev) {
      map.set(k, r)
      continue
    }
    if (score(r) > score(prev)) map.set(k, r)
    else if (score(r) === score(prev)) {
      const lenR = trackDataLength(r)
      const lenP = trackDataLength(prev)
      if (lenR > lenP) map.set(k, r)
      else if (lenR === lenP && r.updatedAt > prev.updatedAt) map.set(k, r)
    }
  }
  return [...map.values()]
}
