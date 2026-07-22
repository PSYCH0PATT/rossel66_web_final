import { buildinCreatePage, buildinUpdatePage } from "@/lib/buildin/client"
import { requireBuildinDatabaseId } from "@/lib/buildin/env"
import {
  checkboxProp,
  dateProp,
  emailProp,
  numberProp,
  selectProp,
  textProp,
  titleProp,
  urlProp,
} from "@/lib/buildin/types"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"

/** Allowlisted ops fields that may sync Buildin → Postgres later */
export const ARTIST_OPS_ALLOWLIST = [
  "opsStatus",
  "assignee",
  "tags",
  "notes",
  "deadline",
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

export async function syncArtistToBuildin(artist: ArtistSyncInput) {
  const dbId = requireBuildinDatabaseId("artists")
  const existing = await getExternalId("artist", artist.id)

  const properties = {
    Имя: titleProp(artist.name || artist.username),
    Username: textProp(artist.username),
    "Local ID": textProp(artist.id),
    Email: emailProp(artist.email ?? null),
    Verified: checkboxProp(artist.verified !== false),
    "Ops Status": selectProp(artist.opsStatus || "active"),
    Assignee: textProp(artist.assignee || ""),
    Notes: textProp(artist.notes || ""),
    "VK Music": urlProp(artist.vkMusicUrl || null),
    "Yandex Music": urlProp(artist.yandexMusicUrl || null),
    Spotify: urlProp(artist.spotifyUrl || null),
    "Sync Version": numberProp(artist.version ?? 1),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
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
    { parent: { database_id: dbId }, properties },
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
}

export const RELEASE_OPS_ALLOWLIST = [
  "opsStatus",
  "assignee",
  "deadline",
  "notes",
] as const

export async function syncReleaseToBuildin(release: ReleaseSyncInput) {
  const dbId = requireBuildinDatabaseId("releases")
  const existing = await getExternalId("release", release.id)

  const dateOnly =
    release.releaseDate && /^\d{4}-\d{2}-\d{2}/.test(release.releaseDate)
      ? release.releaseDate.slice(0, 10)
      : null

  const properties = {
    Название: titleProp(release.title),
    "Local ID": textProp(release.id),
    "Artist ID": textProp(release.artistId || ""),
    "Artist Name": textProp(release.artistName || ""),
    UPC: textProp(release.upc || ""),
    "Release Date": dateProp(dateOnly),
    Type: textProp(release.type || ""),
    "Auto Status": textProp(release.autoStatus || ""),
    "Ops Status": selectProp(release.opsStatus || "intake"),
    Assignee: textProp(release.assignee || ""),
    Notes: textProp(release.notes || ""),
    Cover: urlProp(release.coverUrl || null),
    Bandlink: urlProp(release.bandlinkUrl || null),
    "Sync Version": numberProp(release.version ?? 1),
  }

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
    await upsertExternalId({
      entityType: "release",
      localId: release.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "releases",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

  const page = await buildinCreatePage(
    { parent: { database_id: dbId }, properties },
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

  const properties = {
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

  if (existing) {
    await buildinUpdatePage(existing.buildinPageId, { properties })
    await upsertExternalId({
      entityType: "track",
      localId: track.id,
      buildinPageId: existing.buildinPageId,
      buildinDbKey: "tracks",
      version: (existing.version ?? 1) + 1,
    })
    return existing.buildinPageId
  }

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
