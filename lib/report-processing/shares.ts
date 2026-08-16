/**
 * Доли роялти между участниками трека.
 *
 * Порт `get_royalty_shares_from_tracks` / `_normalize_share_keys` /
 * `calculate_artist_share` из питон-обработчика, дословно, включая порядок
 * приоритетов — от него зависит, кому и сколько денег достанется.
 */
import type { ArtistReportData } from "./artists"

/** ISRC трека → { имя артиста → доля 0..1 }. */
export type TrackShares = Map<string, Map<string, number>>

type ExportedRelease = {
  tracks?: Array<{ isrc?: string | null; royaltyShares?: Record<string, number> | null }> | null
}

/** Доли из releases.json: проценты приводятся к долям 0..1. */
export function loadRoyaltySharesFromTracks(releases: ExportedRelease[]): TrackShares {
  const trackShares: TrackShares = new Map()
  for (const release of releases) {
    if (!release?.tracks) continue
    for (const track of release.tracks) {
      const isrc = track?.isrc
      const shares = track?.royaltyShares
      if (!isrc || !shares || typeof shares !== "object") continue

      let bucket = trackShares.get(isrc)
      if (!bucket) {
        bucket = new Map()
        trackShares.set(isrc, bucket)
      }
      for (const [artistName, percentage] of Object.entries(shares)) {
        // Питон отбрасывал null и неположительные значения.
        if (percentage === null || percentage === undefined) continue
        const numeric = typeof percentage === "number" ? percentage : Number(percentage)
        if (!Number.isFinite(numeric) || numeric <= 0) continue
        bucket.set(artistName, numeric / 100)
      }
    }
  }
  return trackShares
}

/**
 * Переводит имена в долях на canonical главного профиля.
 *
 * Доли записаны именами, а после склейки связанных профилей доля, записанная
 * под именем привязанного, не нашлась бы по canonical — расчёт молча свалился
 * бы на равное деление. Доли одной группы складываются.
 */
export function normalizeShareKeys(
  trackShares: TrackShares,
  aliasToCanonical: Map<string, string>
): TrackShares {
  if (aliasToCanonical.size === 0) return trackShares
  const normalized: TrackShares = new Map()
  for (const [trackCode, shares] of trackShares) {
    const merged = new Map<string, number>()
    for (const [artistName, value] of shares) {
      const key = aliasToCanonical.get(artistName) ?? artistName
      merged.set(key, (merged.get(key) ?? 0) + value)
    }
    normalized.set(trackCode, merged)
  }
  return normalized
}

/**
 * Доля артиста в треке. Порядок приоритетов важен и воспроизведён точно.
 *
 * Отдельно стоит знать про пункт 5: доля неполных артистов (их нет в
 * artistsData) перераспределяется между «нашими», поэтому суммарно по строке
 * может быть выплачено больше 100%. Это фактическое поведение питона.
 */
export function calculateArtistShare(
  trackCode: unknown,
  artist: string,
  allArtistsInTrack: string[],
  artistsData: Map<string, ArtistReportData>,
  royaltyShares: TrackShares,
  trackRoyaltyShares: TrackShares
): number {
  // 1. Артист один в треке — 100%, даже если в releases.json прописано иное.
  if (allArtistsInTrack.length === 1) return 1

  const code = typeof trackCode === "string" ? trackCode : String(trackCode)

  // 2. Доли из releases.json.
  const fromTracks = trackRoyaltyShares.get(code)
  if (fromTracks?.has(artist)) return fromTracks.get(artist)!

  // 3. Доли из отдельного файла (в проде не передаётся).
  const fromFile = royaltyShares.get(code)
  if (fromFile?.has(artist)) return fromFile.get(artist)!

  // 4. Все участники — наши: делим поровну.
  if (allArtistsInTrack.every((a) => artistsData.has(a))) {
    return 1 / allArtistsInTrack.length
  }

  // 5. Иначе делим только между нашими.
  const ourCount = allArtistsInTrack.filter((a) => artistsData.has(a)).length
  if (ourCount > 0) return 1 / ourCount

  // 6. Никого из наших — ноль.
  return 0
}

/**
 * Процент артиста: число для расчёта и текст для ячейки D15.
 *
 * Питон: strip → убрать «%» → запятая в точку; при провале разбора — 100%.
 * Текст обрезает хвостовые нули только если в строке была точка.
 */
export function parsePercentage(raw: string): { fraction: number; text: string } {
  const cleaned = String(raw).trim().replace(/%/g, "").replace(/,/g, ".")
  const value = Number(cleaned)
  if (cleaned === "" || !Number.isFinite(value)) {
    return { fraction: 1, text: "100%" }
  }
  const text = cleaned.includes(".")
    ? `${cleaned.replace(/0+$/, "").replace(/\.$/, "")}%`
    : `${cleaned}%`
  return { fraction: value / 100, text }
}
