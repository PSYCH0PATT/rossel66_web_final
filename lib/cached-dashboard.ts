import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import type { Release } from "@/lib/storage"
import { normalizeArtistName } from "@/lib/storage"
import { reportFromPrisma, releaseFromPrisma, userFromPrisma } from "@/lib/storage-adapters"
import {
  dedupePlaylistsByUrlAndName,
  playlistRowVisibleToCabinetUser,
} from "@/lib/playlist-artist-match"
import { getActivitiesFiltered, type Activity, type Report, type User } from "@/lib/storage"
import { getStreamAnalytics, type StreamFilters } from "@/lib/flash-storage"

/** Серверный кеш дашбордов и тяжёлых агрегатов — 10 минут */
export const DASHBOARD_REVALIDATE_SEC = 600

export type ArtistDashboardPayload = {
  artist: {
    id: string
    username: string
    name: string
    email: string
    role: string
    avatarUrl: string | null
    vkMusicUrl: string | null
    yandexMusicUrl: string | null
    spotifyUrl: string | null
    fio: string | null
    fioShort: string | null
    contract: string | null
    percentage: number | null
    verified: boolean
  }
  releases: Release[]
  reports: Array<{
    id: string
    artistId: string | null
    artistName: string
    quarter: string
    year: number | null
    fileName: string
    uploadDate: string | null
    status: string | null
    isRegistered: boolean | null
    totalPlays: number | null
    totalAmount: number | null
    isSigned: boolean | null
    isPaid: boolean | null
  }>
  playlists: Array<{
    id: string
    playlist_url: string
    playlist_name: string
    platform: string
    artist_name: string
    artist_id: string | null
    track_data: string
    first_seen_date: string | null
    last_seen_date: string | null
    created_at: string
    updated_at: string
  }>
}

export type ArtistDashboardResult =
  | { ok: true; data: ArtistDashboardPayload }
  | { ok: false; reason: "not_found" }

async function loadArtistDashboardUncached(username: string): Promise<ArtistDashboardResult> {
  const artist = await prisma.user.findFirst({
    where: { username, role: "artist" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      vkMusicUrl: true,
      yandexMusicUrl: true,
      spotifyUrl: true,
      fio: true,
      fioShort: true,
      contract: true,
      percentage: true,
      verified: true,
    },
  })

  if (!artist) return { ok: false, reason: "not_found" }

  const artistId = artist.id

  const [releasesRaw, reportsRaw] = await Promise.all([
    prisma.release.findMany({
      where: {
        OR: [{ artistId }, { featuredArtistIds: { has: artistId } }],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.report.findMany({
      where: { artistId, isRegistered: true },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        artistId: true,
        artistName: true,
        quarter: true,
        year: true,
        fileName: true,
        uploadDate: true,
        status: true,
        isRegistered: true,
        totalPlays: true,
        totalAmount: true,
        isSigned: true,
        isPaid: true,
      },
    }),
  ])

  const releases = releasesRaw.map(releaseFromPrisma)
  const reports = reportsRaw.map((r) => ({
    id: r.id,
    artistId: r.artistId,
    artistName: r.artistName,
    quarter: r.quarter,
    year: r.year,
    fileName: r.fileName,
    uploadDate: r.uploadDate,
    status: r.status,
    isRegistered: r.isRegistered,
    totalPlays: r.totalPlays,
    totalAmount: r.totalAmount,
    isSigned: r.isSigned,
    isPaid: r.isPaid,
  }))

  // Та же выборка, что и на странице плейлистов (коллабы + artistId).
  const playlists = await loadArtistPlaylistsUncached(artistId)

  return {
    ok: true,
    data: {
      artist: {
        ...artist,
        email: artist.email ?? "",
      },
      releases,
      reports,
      playlists,
    },
  }
}

export const getCachedArtistDashboard = unstable_cache(
  async (username: string) => loadArtistDashboardUncached(username),
  ["artist-dashboard-v3"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export type PublicUser = {
  id: string
  username: string
  name: string
  email?: string
  role: string
  avatarUrl?: string
  vkMusicUrl?: string
  yandexMusicUrl?: string
  spotifyUrl?: string
}

export type AdminDashboardPayload = {
  users: PublicUser[]
  releases: Release[]
  payments: Array<{
    id: string
    reportId: string
    artistId: string | null
    artistName: string
    quarter: string
    year: number | null
    amount: number | null
    date: string | null
    isPaid: boolean | null
    isSigned: boolean | null
  }>
  reports: Array<{
    id: string
    artistId: string | null
    artistName: string
    quarter: string
    year: number | null
    fileName: string
    uploadDate: string | null
    status: string | null
    isRegistered: boolean | null
    totalPlays: number | null
    totalAmount: number | null
    isSigned: boolean | null
    isPaid: boolean | null
  }>
}

function dedupeReportsByArtistQuarterYear<T extends Report>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.quarter}|${r.year}|${(r.artistName || "").trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadAdminDashboardUncached(): Promise<AdminDashboardPayload> {
  const [usersRaw, releasesRaw, rawReports] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.release.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.report.findMany({
      where: { isRegistered: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ])

  const users: User[] = usersRaw.map(userFromPrisma)
  const releases = releasesRaw.map(releaseFromPrisma)
  const userById = new Map(users.map((u) => [u.id, u]))

  const allReports = rawReports.map(reportFromPrisma)
  const deduped = dedupeReportsByArtistQuarterYear(allReports)
  const reports = deduped.map((r) => ({
    id: r.id,
    artistId: r.artistId ?? null,
    artistName: r.artistName,
    quarter: r.quarter,
    year: r.year ?? null,
    fileName: r.fileName,
    uploadDate: r.uploadDate ?? null,
    status: r.status ?? null,
    isRegistered: r.isRegistered ?? null,
    totalPlays: r.totalPlays ?? null,
    totalAmount: r.totalAmount ?? null,
    isSigned: r.isSigned ?? null,
    isPaid: r.isPaid ?? null,
  }))

  const payments = deduped
    .filter((r) => r.isRegistered)
    .map((report) => {
      const artist = report.artistId ? userById.get(report.artistId) : undefined
      return {
        id: `payment_${report.id}`,
        reportId: report.id,
        artistId: report.artistId,
        artistName: artist ? artist.name : report.artistName,
        quarter: report.quarter,
        year: report.year ?? null,
        amount: report.totalAmount ?? null,
        date: report.uploadDate ?? null,
        isPaid: report.isPaid ?? null,
        isSigned: report.isSigned ?? null,
      }
    })
    .sort((a, b) => {
      if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0)
      const qa = parseInt(String(a.quarter).substring(1), 10) || 0
      const qb = parseInt(String(b.quarter).substring(1), 10) || 0
      return qb - qa
    })

  const publicUsers: PublicUser[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl,
    vkMusicUrl: u.vkMusicUrl,
    yandexMusicUrl: u.yandexMusicUrl,
    spotifyUrl: u.spotifyUrl,
  }))

  return {
    users: publicUsers,
    releases,
    payments,
    reports,
  }
}

export const getCachedAdminDashboard = unstable_cache(
  async () => loadAdminDashboardUncached(),
  ["admin-dashboard-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export const getCachedStreamAnalytics = unstable_cache(
  async (filters: StreamFilters) => getStreamAnalytics(filters),
  ["stream-analytics-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export const getCachedActivitiesForFeed = unstable_cache(
  async (userId: string | null, role: "artist" | "admin" | null, limit: number): Promise<Activity[]> => {
    const filters: Parameters<typeof getActivitiesFiltered>[0] = {}
    if (userId) filters.userId = userId
    if (role) filters.role = role
    const { activities } = await getActivitiesFiltered(filters, limit, 0)
    return activities
  },
  ["activities-feed-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

// ─── Per-artist page loaders ──────────────────────────────────────────────────

export type ArtistReportItem = {
  id: string
  artistId: string | null
  artistName: string
  quarter: string
  year: number | null
  fileName: string
  uploadDate: string | null
  status: string | null
  isRegistered: boolean | null
  totalPlays: number | null
  totalAmount: number | null
  isSigned: boolean | null
  isPaid: boolean | null
}

export type ArtistReleaseItem = Release

export type ArtistPlaylistItem = {
  id: string
  playlist_url: string
  playlist_name: string
  platform: string
  artist_name: string
  artist_id: string | null
  track_data: string
  first_seen_date: string | null
  last_seen_date: string | null
  created_at: string
  updated_at: string
}

async function loadArtistReportsUncached(artistId: string): Promise<ArtistReportItem[]> {
  const rows = await prisma.report.findMany({
    where: { artistId, isRegistered: true },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
    select: {
      id: true,
      artistId: true,
      artistName: true,
      quarter: true,
      year: true,
      fileName: true,
      uploadDate: true,
      status: true,
      isRegistered: true,
      totalPlays: true,
      totalAmount: true,
      isSigned: true,
      isPaid: true,
    },
  })
  return rows
}

export const getCachedArtistReports = unstable_cache(
  async (artistId: string) => loadArtistReportsUncached(artistId),
  ["artist-reports-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

async function loadArtistReleasesUncached(artistId: string): Promise<ArtistReleaseItem[]> {
  const rows = await prisma.release.findMany({
    where: { artistId },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(releaseFromPrisma)
}

export const getCachedArtistReleases = unstable_cache(
  async (artistId: string) => loadArtistReleasesUncached(artistId),
  ["artist-releases-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

const artistPlaylistSelect = {
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

function mapPrismaPlaylistToArtistItem(p: {
  id: string
  playlistUrl: string
  playlistName: string
  platform: string
  artistName: string
  artistId: string | null
  trackData: unknown
  firstSeenDate: string | null
  lastSeenDate: string | null
  createdAt: Date
  updatedAt: Date
}): ArtistPlaylistItem {
  return {
    id: p.id,
    playlist_url: p.playlistUrl,
    playlist_name: p.playlistName,
    platform: p.platform,
    artist_name: p.artistName,
    artist_id: p.artistId,
    track_data: JSON.stringify(p.trackData),
    first_seen_date: p.firstSeenDate,
    last_seen_date: p.lastSeenDate,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  }
}

async function loadArtistPlaylistsUncached(artistId: string): Promise<ArtistPlaylistItem[]> {
  const user = await prisma.user.findFirst({
    where: { id: artistId, role: "artist" },
    select: { id: true, name: true, username: true },
  })
  if (!user) return []

  const assigned = await prisma.playlist.findMany({
    where: { artistId: user.id },
    orderBy: { updatedAt: "desc" },
    select: artistPlaylistSelect,
  })

  const orContains: Array<{ artistName: { contains: string; mode: "insensitive" } }> = []
  const uTrim = user.username.trim()
  const nameTrim = (user.name || "").trim()
  if (uTrim.length >= 2) {
    orContains.push({ artistName: { contains: uTrim, mode: "insensitive" } })
  }
  if (
    nameTrim.length >= 2 &&
    normalizeArtistName(nameTrim) !== normalizeArtistName(user.username)
  ) {
    orContains.push({ artistName: { contains: nameTrim, mode: "insensitive" } })
  }

  let loose: typeof assigned = []
  if (orContains.length > 0) {
    loose = await prisma.playlist.findMany({
      where: { artistId: null, OR: orContains },
      orderBy: { updatedAt: "desc" },
      select: artistPlaylistSelect,
    })
  }

  const extra = loose.filter((r) =>
    playlistRowVisibleToCabinetUser(
      { artistName: r.artistName, artistId: r.artistId },
      user.id,
      user.name || "",
      user.username || ""
    )
  )

  const merged = dedupePlaylistsByUrlAndName([...assigned, ...extra], user.id)
  merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  return merged.map(mapPrismaPlaylistToArtistItem)
}

export const getCachedArtistPlaylists = unstable_cache(
  async (artistId: string) => loadArtistPlaylistsUncached(artistId),
  ["artist-playlists-v2"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export type AdminPaymentItem = {
  id: string
  reportId: string
  artistId: string | null
  artistName: string
  quarter: string
  year: number | null
  amount: number | null
  date: string | null
  isPaid: boolean | null
  isSigned: boolean | null
}

async function loadAdminPaymentsUncached(): Promise<AdminPaymentItem[]> {
  const rows = await prisma.report.findMany({
    where: { isRegistered: true },
    select: {
      id: true,
      artistId: true,
      artistName: true,
      quarter: true,
      year: true,
      totalAmount: true,
      isPaid: true,
      isSigned: true,
      uploadDate: true,
    },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  })
  return rows.map((r) => ({
    id: `payment_${r.id}`,
    reportId: r.id,
    artistId: r.artistId,
    artistName: r.artistName,
    quarter: r.quarter,
    year: r.year,
    amount: r.totalAmount,
    date: r.uploadDate,
    isPaid: r.isPaid,
    isSigned: r.isSigned,
  }))
}

export const getCachedAdminPayments = unstable_cache(
  async () => loadAdminPaymentsUncached(),
  ["admin-payments-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export type AdminArtistItem = {
  id: string
  username: string
  name: string
  email: string
  avatarUrl: string | null
  vkMusicUrl: string | null
  yandexMusicUrl: string | null
  spotifyUrl: string | null
  fio: string | null
  fioShort: string | null
  contract: string | null
  percentage: number | null
  verified: boolean
}

async function loadAdminArtistsUncached(): Promise<AdminArtistItem[]> {
  const rows = await prisma.user.findMany({
    where: { role: "artist" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      avatarUrl: true,
      vkMusicUrl: true,
      yandexMusicUrl: true,
      spotifyUrl: true,
      fio: true,
      fioShort: true,
      contract: true,
      percentage: true,
      verified: true,
    },
  })
  return rows.map((a) => ({ ...a, verified: a.verified ?? true }))
}

export const getCachedAdminArtists = unstable_cache(
  async () => loadAdminArtistsUncached(),
  ["admin-artists-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

export type AdminReleaseItem = Release

async function loadAdminReleasesUncached(): Promise<AdminReleaseItem[]> {
  const rows = await prisma.release.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map(releaseFromPrisma)
}

export const getCachedAdminReleases = unstable_cache(
  async () => loadAdminReleasesUncached(),
  ["admin-releases-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)
