import { getBuildinApiToken, getBuildinDatabaseId } from "@/lib/buildin/env"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import type { OutboxEventType } from "@/lib/buildin/types"

function syncEnabled(): boolean {
  return Boolean(getBuildinApiToken())
}

async function safeEnqueue(
  eventType: OutboxEventType,
  payload: Record<string, unknown>,
  dbKey?: Parameters<typeof getBuildinDatabaseId>[0]
) {
  if (!syncEnabled()) return
  if (dbKey && !getBuildinDatabaseId(dbKey)) return
  try {
    await enqueueBuildinOutbox({ eventType, payload })
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
      // Never sync password / role / session
    },
    "artists"
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
      // Auto status from Koala/Zvonko — mirror only, never overwritten by opsStatus
      autoStatus: release.autoStatus ?? null,
      opsStatus: "intake",
      coverUrl: release.coverUrl ?? null,
      bandlinkUrl: release.bandlinkUrl ?? null,
    },
    "releases"
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
    "tracks"
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
      // Financial fields mirrored read-only
      totalAmount: report.totalAmount ?? null,
      totalPlays: report.totalPlays ?? null,
      isPaid: report.isPaid ?? false,
      isSigned: report.isSigned ?? false,
      isAcknowledged: report.isAcknowledged ?? false,
      isRegistered: report.isRegistered ?? true,
      fileUrl: report.fileUrl ?? null,
    },
    "reports"
  )
}

export async function enqueuePlaylistSync(pl: {
  id: string
  playlistName: string
  playlistUrl: string
  platform: string
  artistId?: string | null
  artistName?: string | null
  firstSeenDate?: string | null
  lastSeenDate?: string | null
  coverUrl?: string | null
}) {
  await safeEnqueue("sync_playlist", { ...pl }, "playlists")
}

export async function enqueueActivitySync(a: {
  id: string
  type: string
  userId?: string | null
  userRole: string
  title: string
  description: string
  createdAt: Date | string
}) {
  await safeEnqueue(
    "sync_activity",
    {
      id: a.id,
      type: a.type,
      userId: a.userId ?? null,
      userRole: a.userRole,
      title: a.title,
      description: a.description,
      createdAt: a.createdAt,
    },
    "activity"
  )
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
    "automation_runs"
  )
}

export async function enqueuePlaylistHistorySync(h: {
  id: string
  playlistName: string
  playlistUrl: string
  platform: string
  changeType: string
  changeDate: string
  artistName?: string | null
  trackTitle?: string | null
}) {
  await safeEnqueue("sync_playlist_history", { ...h }, "playlist_history")
}
