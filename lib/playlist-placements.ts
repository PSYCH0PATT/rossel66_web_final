import { prisma } from "@/lib/prisma"
import { mskDateString } from "@/lib/msk-date"
import type { ParsedTrack } from "@/lib/sftp-playlist-parser"

function normalizePart(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

/**
 * Stable identity for BuildinExternalId + PlaylistTrackPlacement.placementKey.
 * Prefer ISRC; otherwise artist + track title under playlist URL.
 */
export function playlistPlacementKey(opts: {
  playlistUrl: string
  isrc?: string | null
  artistName: string
  trackTitle: string
}): string {
  const url = normalizePart(opts.playlistUrl)
  const isrc = (opts.isrc || "").trim().toUpperCase()
  if (isrc) return `${url}::isrc:${isrc}`
  const artist = normalizePart(opts.artistName || "unknown")
  const title = normalizePart(opts.trackTitle || "untitled")
  return `${url}::track:${artist}::${title}`
}

export function trackTitleFromParsed(
  track: Pick<ParsedTrack, "trackTitle" | "titleArtist">
): string {
  const title = (track.trackTitle || "").trim()
  if (title) return title
  const full = (track.titleArtist || "").trim()
  if (!full) return "Untitled"
  const dash = full.indexOf(" - ")
  if (dash > 0) return full.slice(dash + 3).trim() || full
  return full
}

/** Accept only calendar days YYYY-MM-DD (optional time suffix stripped). */
export function parseObservationDate(
  value: string | null | undefined
): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const day = trimmed.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return day
}

/**
 * Earliest valid observation day among candidates.
 * Never invents a date — returns null if none are valid.
 */
export function earliestObservationDate(
  ...candidates: Array<string | null | undefined>
): string | null {
  let best: string | null = null
  for (const c of candidates) {
    const day = parseObservationDate(c)
    if (!day) continue
    if (!best || day < best) best = day
  }
  return best
}

function earlierDate(a: string, b: string): string {
  return a <= b ? a : b
}

/**
 * Resolve firstSeen for a placement: min of every known signal, never later than today.
 * Prefer existing / legacy title-key / seed / CSV parsed_date / parent playlist / today.
 */
export function resolvePlacementFirstSeen(opts: {
  existingFirstSeen?: string | null
  legacyTitleFirstSeen?: string | null
  seed?: string | null
  trackParsedDate?: string | null
  playlistFirstSeenDate?: string | null
  today: string
}): string {
  return (
    earliestObservationDate(
      opts.existingFirstSeen,
      opts.legacyTitleFirstSeen,
      opts.seed,
      opts.trackParsedDate,
      opts.playlistFirstSeenDate,
      opts.today
    ) || opts.today
  )
}

/**
 * Upsert active placements for tracks in one playlist+artist row.
 * Deactivates placements for this playlistUrl+artistName that are missing.
 * Never resets firstSeenDate on reactivate; can only move earlier.
 */
export async function syncPlacementsForArtistPlaylist(opts: {
  playlistUrl: string
  playlistName: string
  platform: string
  artistName: string
  artistId?: string | null
  playlistRowId: string
  tracks: ParsedTrack[]
  today?: string
  /** Parent Playlist.firstSeenDate — always preferred over bare today. */
  playlistFirstSeenDate?: string | null
  /** Seed firstSeen when creating (e.g. migration from history). */
  seedFirstSeenByKey?: Map<string, string>
}): Promise<{
  upserted: Array<{
    id: string
    placementKey: string
    firstSeenDate: string
    lastSeenDate: string
    isActive: boolean
    trackTitle: string
    artistName: string
    playlistName: string
    playlistUrl: string
    platform: string
    artistId: string | null
    changed: boolean
  }>
  deactivated: Array<{
    id: string
    placementKey: string
    trackTitle: string
    artistName: string
    playlistName: string
    playlistUrl: string
    platform: string
    artistId: string | null
    firstSeenDate: string
    lastSeenDate: string
  }>
}> {
  const today = opts.today ?? mskDateString()
  const seenKeys = new Set<string>()
  const upserted: Array<{
    id: string
    placementKey: string
    firstSeenDate: string
    lastSeenDate: string
    isActive: boolean
    trackTitle: string
    artistName: string
    playlistName: string
    playlistUrl: string
    platform: string
    artistId: string | null
    changed: boolean
  }> = []

  for (const track of opts.tracks) {
    const trackTitle = trackTitleFromParsed(track)
    const artistName = track.artistName || opts.artistName
    const isrc = (track.isrc || "").trim() || null
    const key = playlistPlacementKey({
      playlistUrl: opts.playlistUrl,
      isrc,
      artistName,
      trackTitle,
    })
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    const existing = await prisma.playlistTrackPlacement.findUnique({
      where: { placementKey: key },
    })

    // When ISRC appears later, title-key row held the real firstSeen — transfer it.
    let legacyTitleFirstSeen: string | null = null
    if (isrc && !existing) {
      const titleKey = playlistPlacementKey({
        playlistUrl: opts.playlistUrl,
        artistName,
        trackTitle,
      })
      if (titleKey !== key) {
        const legacy = await prisma.playlistTrackPlacement.findUnique({
          where: { placementKey: titleKey },
        })
        if (legacy) legacyTitleFirstSeen = legacy.firstSeenDate
      }
    }

    const seed = opts.seedFirstSeenByKey?.get(key)
    const firstSeen = resolvePlacementFirstSeen({
      existingFirstSeen: existing?.firstSeenDate,
      legacyTitleFirstSeen,
      seed,
      trackParsedDate: track.parsedDate,
      playlistFirstSeenDate: opts.playlistFirstSeenDate,
      today,
    })

    if (!existing) {
      const created = await prisma.playlistTrackPlacement.create({
        data: {
          placementKey: key,
          playlistUrl: opts.playlistUrl,
          playlistName: opts.playlistName,
          platform: opts.platform,
          artistName,
          artistId: opts.artistId ?? null,
          trackTitle,
          isrc,
          firstSeenDate: firstSeen,
          lastSeenDate: today,
          isActive: true,
          playlistRowId: opts.playlistRowId,
        },
      })
      upserted.push({
        id: created.id,
        placementKey: created.placementKey,
        firstSeenDate: created.firstSeenDate,
        lastSeenDate: created.lastSeenDate,
        isActive: true,
        trackTitle: created.trackTitle,
        artistName: created.artistName,
        playlistName: created.playlistName,
        playlistUrl: created.playlistUrl,
        platform: created.platform,
        artistId: created.artistId,
        changed: true,
      })
      continue
    }

    const nextFirst = earlierDate(existing.firstSeenDate, firstSeen)
    const needsUpdate =
      !existing.isActive ||
      existing.lastSeenDate !== today ||
      existing.playlistName !== opts.playlistName ||
      existing.platform !== opts.platform ||
      existing.artistName !== artistName ||
      existing.trackTitle !== trackTitle ||
      existing.playlistRowId !== opts.playlistRowId ||
      (opts.artistId && existing.artistId !== opts.artistId) ||
      nextFirst !== existing.firstSeenDate

    if (!needsUpdate) {
      upserted.push({
        id: existing.id,
        placementKey: existing.placementKey,
        firstSeenDate: existing.firstSeenDate,
        lastSeenDate: existing.lastSeenDate,
        isActive: existing.isActive,
        trackTitle: existing.trackTitle,
        artistName: existing.artistName,
        playlistName: existing.playlistName,
        playlistUrl: existing.playlistUrl,
        platform: existing.platform,
        artistId: existing.artistId,
        changed: false,
      })
      continue
    }

    const updated = await prisma.playlistTrackPlacement.update({
      where: { id: existing.id },
      data: {
        playlistName: opts.playlistName,
        platform: opts.platform,
        artistName,
        artistId: opts.artistId ?? existing.artistId,
        trackTitle,
        isrc: isrc || existing.isrc,
        firstSeenDate: nextFirst,
        lastSeenDate: today,
        isActive: true,
        playlistRowId: opts.playlistRowId,
      },
    })
    upserted.push({
      id: updated.id,
      placementKey: updated.placementKey,
      firstSeenDate: updated.firstSeenDate,
      lastSeenDate: updated.lastSeenDate,
      isActive: true,
      trackTitle: updated.trackTitle,
      artistName: updated.artistName,
      playlistName: updated.playlistName,
      playlistUrl: updated.playlistUrl,
      platform: updated.platform,
      artistId: updated.artistId,
      changed: true,
    })
  }

  const stale = await prisma.playlistTrackPlacement.findMany({
    where: {
      playlistUrl: opts.playlistUrl,
      artistName: opts.artistName,
      isActive: true,
      placementKey: { notIn: Array.from(seenKeys) },
    },
  })

  const deactivated: Array<{
    id: string
    placementKey: string
    trackTitle: string
    artistName: string
    playlistName: string
    playlistUrl: string
    platform: string
    artistId: string | null
    firstSeenDate: string
    lastSeenDate: string
  }> = []

  for (const row of stale) {
    await prisma.playlistTrackPlacement.update({
      where: { id: row.id },
      data: { isActive: false, lastSeenDate: today },
    })
    deactivated.push({
      id: row.id,
      placementKey: row.placementKey,
      trackTitle: row.trackTitle,
      artistName: row.artistName,
      playlistName: row.playlistName,
      playlistUrl: row.playlistUrl,
      platform: row.platform,
      artistId: row.artistId,
      firstSeenDate: row.firstSeenDate,
      lastSeenDate: today,
    })
  }

  return { upserted, deactivated }
}

/**
 * Deactivate all placements for aggregate playlist row(s) and return them for archive sync.
 */
export async function deactivatePlacementsForPlaylistRows(
  playlistRowIds: string[],
  today = mskDateString()
) {
  if (playlistRowIds.length === 0) return []
  const rows = await prisma.playlistTrackPlacement.findMany({
    where: { playlistRowId: { in: playlistRowIds }, isActive: true },
  })
  if (rows.length === 0) return []
  await prisma.playlistTrackPlacement.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { isActive: false, lastSeenDate: today },
  })
  return rows.map((r) => ({ ...r, isActive: false, lastSeenDate: today }))
}

/**
 * Earliest known firstSeen among placements for playlistUrl + artistName.
 * Used when recreating a Playlist row after cleanup.
 */
export async function earliestPlacementFirstSeenForPlaylist(opts: {
  playlistUrl: string
  artistName: string
}): Promise<string | null> {
  const rows = await prisma.playlistTrackPlacement.findMany({
    where: {
      playlistUrl: opts.playlistUrl,
      artistName: opts.artistName,
    },
    select: { firstSeenDate: true },
    orderBy: { firstSeenDate: "asc" },
    take: 1,
  })
  return parseObservationDate(rows[0]?.firstSeenDate) ?? null
}

/**
 * Earliest PlaylistHistory.changeDate per placement key (best-effort seed).
 */
export async function earliestHistoryDatesByPlacementKey(): Promise<
  Map<string, string>
> {
  const history = await prisma.playlistHistory.findMany({
    where: { changeType: { in: ["added", "updated"] } },
    select: {
      playlistUrl: true,
      artistName: true,
      trackTitle: true,
      changeDate: true,
    },
    orderBy: { changeDate: "asc" },
  })
  const map = new Map<string, string>()
  for (const h of history) {
    if (!h.trackTitle || !h.artistName) continue
    // History stores titleArtist or track title — try both key shapes without ISRC
    const title = trackTitleFromParsed({
      trackTitle: h.trackTitle,
      titleArtist: h.trackTitle,
    })
    const key = playlistPlacementKey({
      playlistUrl: h.playlistUrl,
      artistName: h.artistName,
      trackTitle: title,
    })
    const prev = map.get(key)
    if (!prev || h.changeDate < prev) map.set(key, h.changeDate)
  }
  return map
}
