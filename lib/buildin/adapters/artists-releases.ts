import { buildinCreatePage, buildinUpdatePage } from "@/lib/buildin/client"
import { requireBuildinDatabaseId } from "@/lib/buildin/env"
import {
  checkboxProp,
  dateProp,
  emailProp,
  numberProp,
  relationProp,
  selectProp,
  textProp,
  titleProp,
  urlProp,
} from "@/lib/buildin/types"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"
import {
  ARTIST_OPS_STATUS_LABELS,
  RELEASE_OPS_STATUS_LABELS,
  labelFor,
} from "@/lib/buildin/labels"

/** Allowlisted ops fields that may sync Buildin → Postgres later */
export const ARTIST_OPS_ALLOWLIST = [
  "opsStatus",
  "assignee",
  "tags",
  "notes",
  "deadline",
] as const

/** Buildin property names owned by ops (never overwritten by forward sync updates). */
export const ARTIST_OPS_PROPERTY_KEYS = [
  "Ops Status",
  "Assignee",
  "Tags",
  "Notes",
  "Deadline",
] as const

export type ArtistSyncInput = {
  id: string
  name: string
  username: string
  email?: string | null
  verified?: boolean | null
  vkMusicUrl?: string | null
  yandexMusicUrl?: string | null
  spotifyUrl?: string | null
  opsStatus?: string | null
  assignee?: string | null
  notes?: string | null
  version?: number
}

function artistMirrorProperties(artist: ArtistSyncInput) {
  return {
    Имя: titleProp(artist.name || artist.username),
    Username: textProp(artist.username),
    "Local ID": textProp(artist.id),
    Email: emailProp(artist.email ?? null),
    Verified: checkboxProp(artist.verified !== false),
    "VK Music": urlProp(artist.vkMusicUrl || null),
    "Yandex Music": urlProp(artist.yandexMusicUrl || null),
    Spotify: urlProp(artist.spotifyUrl || null),
    "Sync Version": numberProp(artist.version ?? 1),
  }
}

function artistCreateOpsProperties(artist: ArtistSyncInput) {
  return {
    "Ops Status": selectProp(
      labelFor(ARTIST_OPS_STATUS_LABELS, artist.opsStatus || "active")
    ),
    // Initial empty ops fields only on create — never on update
    Notes: textProp(artist.notes || ""),
  }
}

export async function syncArtistToBuildin(artist: ArtistSyncInput) {
  const dbId = requireBuildinDatabaseId("artists")
  const existing = await getExternalId("artist", artist.id)
  const mirror = artistMirrorProperties(artist)

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties: mirror })
    await upsertExternalId({
      entityType: "artist",
      localId: artist.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "artists",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: { ...mirror, ...artistCreateOpsProperties(artist) },
    },
    `artist:${artist.id}`
  )
  await upsertExternalId({
    entityType: "artist",
    localId: artist.id,
    buildinPageId: page.id,
    buildinDbKey: "artists",
    version: 1,
  })
  return page.id
}

export type ReleaseSyncInput = {
  id: string
  title: string
  artistId?: string | null
  artistName?: string | null
  upc?: string | null
  releaseDate?: string | null
  type?: string | null
  autoStatus?: string | null
  opsStatus?: string | null
  coverUrl?: string | null
  bandlinkUrl?: string | null
  assignee?: string | null
  notes?: string | null
  version?: number
  archived?: boolean
}

export const RELEASE_OPS_ALLOWLIST = [
  "opsStatus",
  "assignee",
  "deadline",
  "notes",
] as const

export const RELEASE_OPS_PROPERTY_KEYS = [
  "Ops Status",
  "Assignee",
  "Deadline",
  "Notes",
] as const

async function releaseMirrorProperties(release: ReleaseSyncInput) {
  const dateOnly =
    release.releaseDate && /^\d{4}-\d{2}-\d{2}/.test(release.releaseDate)
      ? release.releaseDate.slice(0, 10)
      : null

  const props: Record<string, unknown> = {
    Название: titleProp(release.title),
    "Local ID": textProp(release.id),
    "Artist ID": textProp(release.artistId || ""),
    "Artist Name": textProp(release.artistName || ""),
    UPC: textProp(release.upc || ""),
    "Release Date": dateProp(dateOnly),
    Type: textProp(release.type || ""),
    "Auto Status": textProp(release.autoStatus || ""),
    Cover: urlProp(release.coverUrl || null),
    Bandlink: urlProp(release.bandlinkUrl || null),
    "Sync Version": numberProp(release.version ?? 1),
  }

  if (release.artistId) {
    const artistPage = await getExternalId("artist", release.artistId)
    if (artistPage) {
      props["АртистRel"] = relationProp([artistPage.buildinPageId])
    }
  }

  return props
}

function releaseCreateOpsProperties(release: ReleaseSyncInput) {
  return {
    "Ops Status": selectProp(
      labelFor(RELEASE_OPS_STATUS_LABELS, release.opsStatus || "intake")
    ),
    Notes: textProp(release.notes || ""),
  }
}

export async function syncReleaseToBuildin(release: ReleaseSyncInput) {
  const dbId = requireBuildinDatabaseId("releases")
  const existing = await getExternalId("release", release.id)
  const mirror = await releaseMirrorProperties(release)

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, {
      properties: mirror,
      ...(release.archived ? { in_trash: true } : {}),
    })
    await upsertExternalId({
      entityType: "release",
      localId: release.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "releases",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  if (release.archived) {
    // Nothing to create for a tombstone of an unknown page
    return null
  }

  const page = await buildinCreatePage(
    {
      parent: { database_id: dbId },
      properties: { ...mirror, ...releaseCreateOpsProperties(release) },
    },
    `release:${release.id}`
  )
  await upsertExternalId({
    entityType: "release",
    localId: release.id,
    buildinPageId: page.id,
    buildinDbKey: "releases",
    version: 1,
  })
  return page.id
}

export type TrackSyncInput = {
  /** Stable local id: `${releaseId}:${isrc|index}` or track.id */
  id: string
  title: string
  releaseLocalId: string
  submissionId?: string | null
  isrc?: string | null
  artists?: string | null
  language?: string | null
  explicit?: boolean | null
  focus?: boolean | null
  duration?: string | null
  archived?: boolean
}

/** Build a stable track local id for BuildinExternalId mapping. */
export function trackLocalId(
  releaseId: string,
  track: { id?: string | null; isrc?: string | null },
  index: number
): string {
  if (track.id && String(track.id).trim()) return String(track.id).trim()
  if (track.isrc && String(track.isrc).trim()) {
    return `${releaseId}:${String(track.isrc).trim()}`
  }
  return `${releaseId}:${index}`
}

export async function syncTrackToBuildin(track: TrackSyncInput) {
  const dbId = requireBuildinDatabaseId("tracks")
  const existing = await getExternalId("track", track.id)

  const properties: Record<string, unknown> = {
    Название: titleProp(track.title || "Untitled"),
    "Local ID": textProp(track.id),
    "Release Local ID": textProp(track.releaseLocalId),
    "Submission ID": textProp(track.submissionId || ""),
    ISRC: textProp(track.isrc || ""),
    Artists: textProp(track.artists || ""),
    Language: textProp(track.language || ""),
    Explicit: checkboxProp(track.explicit === true),
    Focus: checkboxProp(track.focus === true),
    Duration: textProp(track.duration || ""),
  }

  const releasePage = await getExternalId("release", track.releaseLocalId)
  if (releasePage) {
    properties["РелизRel"] = relationProp([releasePage.buildinPageId])
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, {
      properties,
      ...(track.archived ? { in_trash: true } : {}),
    })
    await upsertExternalId({
      entityType: "track",
      localId: track.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "tracks",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  if (track.archived) return null

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
    `track:${track.id}`
  )
  await upsertExternalId({
    entityType: "track",
    localId: track.id,
    buildinPageId: page.id,
    buildinDbKey: "tracks",
    version: 1,
  })
  return page.id
}

/** Ensure each track in a release JSON array has a stable `id` for sync. */
export function ensureStableTrackIds(
  releaseId: string,
  tracks: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return tracks.map((t, index) => {
    const current = typeof t.id === "string" ? t.id.trim() : ""
    if (current) return t
    const isrc = typeof t.isrc === "string" ? t.isrc : null
    return { ...t, id: trackLocalId(releaseId, { isrc }, index) }
  })
}
