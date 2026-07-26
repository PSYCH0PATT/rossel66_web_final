import { normalizeArtistName } from "@/lib/storage"
import { splitCollaboratingArtistDisplayNames } from "@/lib/split-artist-names"

/** Разделители внутри сегмента (редко в CSV). */
const AND_SPLIT = /\s+(?:и|and)\s+/i

export function tokenizeCollaborationArtistField(raw: string): string[] {
  const s = raw.trim()
  if (!s) return []
  const set = new Set<string>()
  set.add(normalizeArtistName(s))
  for (const piece of splitCollaboratingArtistDisplayNames(s)) {
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

function asTrackArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

/** Ключ трека для объединения: ISRC (или название) + позиция в плейлисте. */
function trackKey(track: Record<string, unknown>): string {
  const isrc = String(track.isrc ?? "").trim().toLowerCase()
  const title = String(track.trackTitle ?? track.titleArtist ?? "").trim().toLowerCase()
  const position = String(track.position ?? "")
  return `${isrc || title}@${position}`
}

/**
 * H7: объединяет трек-листы схлопнутых строк одного плейлиста.
 *
 * Один и тот же плейлист хранится несколькими строками, если поле исполнителя
 * написано по-разному («Artist» и «Artist feat Guest») — уникальный ключ в БД
 * включает artistName. Раньше дедуп оставлял одну строку, и треки остальных
 * просто исчезали из карточки. Теперь треки объединяются по ISRC/названию + позиции.
 */
function mergeTrackData<T extends UrlNameRow>(winner: T, losers: T[]): T {
  const seen = new Set<string>()
  const merged: Record<string, unknown>[] = []

  // Победитель первым — сохраняем его порядок треков.
  for (const row of [winner, ...losers]) {
    for (const track of asTrackArray(row.trackData)) {
      const k = trackKey(track)
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(track)
    }
  }

  if (merged.length === trackDataLength(winner)) return winner
  return { ...winner, trackData: merged }
}

/** Одна карточка на плейлист: приоритет привязки по artistId, затем строка с большим числом треков. */
export function dedupePlaylistsByUrlAndName<T extends UrlNameRow>(rows: T[], userId: string): T[] {
  const key = (r: T) => `${r.playlistUrl}\u0000${r.playlistName}`
  const groups = new Map<string, T[]>()
  const order: string[] = []
  const score = (x: T) => (x.artistId === userId ? 2 : x.artistId ? 1 : 0)

  for (const r of rows) {
    const k = key(r)
    const group = groups.get(k)
    if (!group) {
      groups.set(k, [r])
      order.push(k)
      continue
    }
    group.push(r)
  }

  return order.map((k) => {
    const group = groups.get(k)!
    let winner = group[0]
    for (const r of group.slice(1)) {
      if (score(r) > score(winner)) winner = r
      else if (score(r) === score(winner)) {
        const lenR = trackDataLength(r)
        const lenW = trackDataLength(winner)
        if (lenR > lenW) winner = r
        else if (lenR === lenW && r.updatedAt > winner.updatedAt) winner = r
      }
    }
    if (group.length === 1) return winner
    return mergeTrackData(winner, group.filter((r) => r !== winner))
  })
}
