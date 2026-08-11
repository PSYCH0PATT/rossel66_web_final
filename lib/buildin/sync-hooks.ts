import { getBuildinApiToken, getBuildinDatabaseId } from "@/lib/buildin/env"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import type { OutboxEventType } from "@/lib/buildin/types"

function syncEnabled(): boolean {
  return Boolean(getBuildinApiToken())
}

async function safeEnqueue(
  eventType: OutboxEventType,
  payload: Record<string, unknown>,
  dbKey?: Parameters<typeof getBuildinDatabaseId>[0],
  entityKey?: string
) {
  if (!syncEnabled()) return
  if (dbKey && !getBuildinDatabaseId(dbKey)) return
  try {
    await enqueueBuildinOutbox({ eventType, payload, entityKey })
  } catch (err) {
    console.error(`[buildin] enqueue ${eventType} failed:`, err)
  }
}

export async function enqueueArtistSync(artist: {
  id: string
  name: string
  username: string
  email?: string | null
  verified?: boolean | null
  vkMusicUrl?: string | null
  yandexMusicUrl?: string | null
  spotifyUrl?: string | null
}) {
  await safeEnqueue(
    "sync_artist",
    {
      id: artist.id,
      name: artist.name,
      username: artist.username,
      email: artist.email ?? null,
      verified: artist.verified ?? true,
      vkMusicUrl: artist.vkMusicUrl ?? null,
      yandexMusicUrl: artist.yandexMusicUrl ?? null,
      spotifyUrl: artist.spotifyUrl ?? null,
      // Never sync password / role / session; never send ops fields
    },
    "artists",
    artist.id
  )
}

export async function enqueueReleaseSync(release: {
  id: string
  title: string
  artistId?: string | null
  artistName?: string | null
  upc?: string | null
  releaseDate?: string | null
  type?: string | null
  autoStatus?: string | null
  coverUrl?: string | null
  bandlinkUrl?: string | null
}) {
  await safeEnqueue(
    "sync_release",
    {
      id: release.id,
      title: release.title,
      artistId: release.artistId ?? null,
      artistName: release.artistName ?? null,
      upc: release.upc ?? null,
      releaseDate: release.releaseDate ?? null,
      type: release.type ?? null,
      // Auto status from Koala/Zvonko — mirror only; never set Операционный статус
      autoStatus: release.autoStatus ?? null,
      coverUrl: release.coverUrl ?? null,
      bandlinkUrl: release.bandlinkUrl ?? null,
    },
    "releases",
    release.id
  )
}

export async function enqueueTrackSync(track: {
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
}) {
  await safeEnqueue(
    "sync_track",
    {
      id: track.id,
      title: track.title,
      releaseLocalId: track.releaseLocalId,
      submissionId: track.submissionId ?? null,
      isrc: track.isrc ?? null,
      artists: track.artists ?? null,
      language: track.language ?? null,
      explicit: track.explicit ?? false,
      focus: track.focus ?? false,
      duration: track.duration ?? null,
    },
    "tracks",
    track.id
  )
}

export async function enqueueReportSync(report: {
  id: string
  artistId?: string | null
  artistName: string
  quarter: string
  year?: number | null
  totalAmount?: number | null
  totalPlays?: number | null
  isPaid?: boolean | null
  isSigned?: boolean | null
  isAcknowledged?: boolean | null
  isRegistered?: boolean | null
  fileUrl?: string | null
}) {
  await safeEnqueue(
    "sync_report",
    {
      id: report.id,
      artistId: report.artistId ?? null,
      artistName: report.artistName,
      quarter: report.quarter,
      year: report.year ?? null,
      // Financial fields mirrored read-only; never send ops fields
      totalAmount: report.totalAmount ?? null,
      totalPlays: report.totalPlays ?? null,
      isPaid: report.isPaid ?? false,
      isSigned: report.isSigned ?? false,
      isAcknowledged: report.isAcknowledged ?? false,
      isRegistered: report.isRegistered ?? true,
      fileUrl: report.fileUrl ?? null,
    },
    "reports",
    report.id
  )
}

export async function enqueuePlaylistSync(pl: {
  id: string
  trackTitle: string
  artistName: string
  playlistName: string
  playlistUrl: string
  firstSeenDate?: string | null
  archived?: boolean
}) {
  await safeEnqueue(
    pl.archived ? "archive_playlist" : "sync_playlist",
    {
      id: pl.id,
      trackTitle: pl.trackTitle,
      artistName: pl.artistName,
      playlistName: pl.playlistName,
      playlistUrl: pl.playlistUrl,
      firstSeenDate: pl.firstSeenDate ?? null,
      archived: pl.archived === true,
    },
    "playlists",
    pl.id
  )
}

/** Activity mirroring disabled — archive DB only; history stays in Postgres. */
export async function enqueueActivitySync(_a: {
  id: string
  type: string
  userId?: string | null
  userRole: string
  title: string
  description: string
  createdAt: Date | string
}) {
  return
}

export async function enqueueParserRunSync(run: {
  platform: string
  status: string
  lastRun?: Date | string | null
  needsNewCookies?: boolean
  failedAttempts?: number
  lastError?: string | null
}) {
  await safeEnqueue(
    "sync_parser",
    {
      platform: run.platform,
      status: run.status,
      lastRun: run.lastRun ?? null,
      needsNewCookies: run.needsNewCookies === true,
      failedAttempts: run.failedAttempts ?? 0,
      // Never send cookie values — only alert flag + admin link
      lastError: run.lastError ? String(run.lastError).slice(0, 500) : null,
      adminLink: `/dashboard/admin/parsers`,
    },
    "automation_runs",
    run.platform
  )
}

/** PlaylistHistory mirroring disabled — archive DB only. */
export async function enqueuePlaylistHistorySync(_h: {
  id: string
  playlistName: string
  playlistUrl: string
  platform: string
  changeType: string
  changeDate: string
  artistName?: string | null
  trackTitle?: string | null
}) {
  return
}

export async function enqueueArchiveEntity(opts: {
  entityType: "artist" | "release" | "report" | "playlist" | "track"
  id: string
  title?: string
}) {
  const eventType = `archive_${opts.entityType}` as OutboxEventType
  const dbKey =
    opts.entityType === "artist"
      ? "artists"
      : opts.entityType === "release"
        ? "releases"
        : opts.entityType === "report"
          ? "reports"
          : opts.entityType === "playlist"
            ? "playlists"
            : "tracks"
  await safeEnqueue(
    eventType,
    { id: opts.id, title: opts.title ?? opts.id, archived: true },
    dbKey,
    opts.id
  )
}
