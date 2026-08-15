import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { normalizeArtistName } from "@/lib/storage"
import { reportFromPrisma, userFromPrisma, releaseFromPrisma } from "@/lib/storage-adapters"
import {
  CACHE_TAG_ADMIN_DASHBOARD,
  CACHE_TAG_ARTIST_DASHBOARD,
  CACHE_TAG_ARTIST_PLAYLISTS,
  CACHE_TAG_STREAM_ANALYTICS,
} from "@/lib/dashboard-cache-tags"
import {
  dedupePlaylistsByUrlAndName,
  playlistRowVisibleToCabinetUser,
} from "@/lib/playlist-artist-match"
import { getActivitiesFiltered, type Activity, type Report, type User, type Release } from "@/lib/storage"
import { getStreamAnalytics, type StreamFilters } from "@/lib/flash-storage"
import { findManyPlaylistRows, type PlaylistListRow } from "@/lib/prisma-playlist-read"
import { reportEffectiveYear } from "@/lib/report-year"
import { getArtistGroupIds } from "@/lib/artist-links"

/** Серверный кеш дашбордов — 60s (Timeweb: cold start OK; мутации сбрасывают теги) */
export const DASHBOARD_REVALIDATE_SEC = 60

/**
 * Статусы «доставлен/выпущен» релиза. В данных используется «Доставлен»;
 * 'released' — legacy. Метрики раньше искали только 'released' → всегда 0/все.
 */
const DELIVERED_RELEASE_STATUSES = ["Доставлен", "released"]

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
    mainArtistId: string | null
  }
  releaseCount: number
  releasedCount: number
  playlistCount: number
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
      mainArtistId: true,
    },
  })

  if (!artist) return { ok: false, reason: "not_found" }

  const artistId = artist.id
  // Кабинет у группы связанных профилей (AKA) один: считаем по всем её профилям.
  // Для одиночного артиста группа состоит из него самого, поведение прежнее.
  const groupIds = await getArtistGroupIds(artistId)

  const releaseScope = {
    OR: [
      { artistId: { in: groupIds } },
      { featuredArtistIds: { hasSome: groupIds } },
    ],
  }

  const [releaseCount, releasedCount, reportsRaw, playlistsForCount] = await Promise.all([
    prisma.release.count({ where: releaseScope }),
    prisma.release.count({
      where: { AND: [releaseScope, { status: { in: DELIVERED_RELEASE_STATUSES } }] },
    }),
    prisma.report.findMany({
      where: { artistId: { in: groupIds }, isRegistered: true },
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
    loadArtistPlaylistsUncached(artistId),
  ])

  const playlistCount = playlistsForCount.length
  // C4: один отчёт на (quarter, year) — берём последний загруженный (reportsRaw
  // отсортирован uploadedAt desc), чтобы дубли не задваивали «Заработок».
  const seenReportKeys = new Set<string>()
  const reports = reportsRaw
    .filter((r) => {
      // D2: год из uploadDate, если в отчёте не заполнен (см. lib/report-year.ts)
      // Ключ включает artistId: за один квартал у разных профилей группы могут
      // быть свои отчёты, и они должны сложиться, а не вытеснить друг друга.
      const key = `${r.artistId}|${r.quarter}|${reportEffectiveYear(r)}`
      if (seenReportKeys.has(key)) return false
      seenReportKeys.add(key)
      return true
    })
    .map((r) => ({
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

  return {
    ok: true,
    data: {
      artist: {
        ...artist,
        email: artist.email ?? "",
      },
      releaseCount,
      releasedCount,
      playlistCount,
      reports,
    },
  }
}

export const getCachedArtistDashboard = unstable_cache(
  async (username: string) => loadArtistDashboardUncached(username),
  ["artist-dashboard-v7"],
  {
    revalidate: DASHBOARD_REVALIDATE_SEC,
    tags: [CACHE_TAG_ARTIST_DASHBOARD],
  }
)

export type AdminDashboardPayload = {
  artistCount: number
  releaseCount: number
  pendingReleases: number
  reportCount: number
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
    // D2: у отчёта без year берём год из даты загрузки — иначе несколько таких
    // отчётов за один квартал не схлопнутся (ключ "…|null|…" один и тот же
    // только на вид: их суммы всё равно складывались бы в балансе).
    const key = `${r.quarter}|${reportEffectiveYear(r)}|${(r.artistName || "").trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadAdminDashboardUncached(): Promise<AdminDashboardPayload> {
  const [artistCount, releaseCount, pendingReleases, usersRaw, rawReports] =
    await Promise.all([
      prisma.user.count({ where: { role: "artist" } }),
      prisma.release.count(),
      prisma.release.count({ where: { status: { notIn: DELIVERED_RELEASE_STATUSES } } }),
      prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.report.findMany({
        where: { isRegistered: true },
        orderBy: { uploadedAt: "desc" },
      }),
    ])

  const users: User[] = usersRaw.map(userFromPrisma)
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

  return {
    artistCount,
    releaseCount,
    pendingReleases,
    reportCount: reports.length,
    payments,
    reports,
  }
}

export const getCachedAdminDashboard = unstable_cache(
  async () => loadAdminDashboardUncached(),
  ["admin-dashboard-v2"],
  {
    revalidate: DASHBOARD_REVALIDATE_SEC,
    tags: [CACHE_TAG_ADMIN_DASHBOARD],
  }
)

export const getCachedStreamAnalytics = unstable_cache(
  async (filters: StreamFilters) => getStreamAnalytics(filters),
  ["stream-analytics-v2"],
  {
    revalidate: DASHBOARD_REVALIDATE_SEC,
    tags: [CACHE_TAG_STREAM_ANALYTICS],
  }
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
  isAcknowledged: boolean | null
  acknowledgedAt: string | null
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
  cover_url: string | null
  /** Профиль группы (AKA), которому принадлежит строка — для фильтра в кабинете. */
  profile_id: string
  profile_name: string
}

async function loadArtistReportsUncached(artistId: string): Promise<ArtistReportItem[]> {
  // Кабинет группы показывает отчёты всех её профилей: старые пер-профильные
  // отчёты привязанного никуда не делись и должны остаться видимыми.
  const groupIds = await getArtistGroupIds(artistId)
  const rows = await prisma.report.findMany({
    where: { artistId: { in: groupIds }, isRegistered: true },
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
      isAcknowledged: true,
      acknowledgedAt: true,
    },
  })
  // acknowledgedAt из Prisma — Date; тип ArtistReportItem ждёт ISO-строку
  // (иначе Date утекает на клиент через RSC-барьер, F-UI-8).
  return rows.map((r) => ({
    ...r,
    acknowledgedAt: r.acknowledgedAt ? r.acknowledgedAt.toISOString() : null,
  }))
}

export const getCachedArtistReports = unstable_cache(
  async (artistId: string) => loadArtistReportsUncached(artistId),
  ["artist-reports-v3"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)

async function loadArtistReleasesUncached(artistId: string): Promise<ArtistReleaseItem[]> {
  const rows = await prisma.release.findMany({
    where: { artistId },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(releaseFromPrisma)
}

function mapPrismaPlaylistToArtistItem(
  p: PlaylistListRow,
  profile?: { id: string; name?: string | null; username?: string | null }
): ArtistPlaylistItem {
  return {
    profile_id: profile?.id ?? p.artistId ?? "",
    profile_name: profile?.name || profile?.username || "",
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
    cover_url: p.coverUrl ?? null,
  }
}

/** Экспортирован для тестов: unstable_cache не работает вне контекста запроса Next. */
export async function loadArtistPlaylistsUncached(artistId: string): Promise<ArtistPlaylistItem[]> {
  // Кабинет у группы связанных профилей (AKA) один, поэтому плейлисты собираются
  // по всем её профилям. Сопоставление по имени пер-профильное: у каждого профиля
  // своё имя, под которым его находят в плейлистах.
  const groupIds = await getArtistGroupIds(artistId)
  const members = await prisma.user.findMany({
    where: { id: { in: groupIds }, role: "artist" },
    select: { id: true, name: true, username: true },
  })
  if (members.length === 0) return []

  const collected: Array<PlaylistListRow & { profileId: string }> = []

  for (const user of members) {
    const assigned = await findManyPlaylistRows({
      where: { artistId: user.id },
      orderBy: { updatedAt: "desc" },
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

    let loose: PlaylistListRow[] = []
    if (orContains.length > 0) {
      loose = await findManyPlaylistRows({
        where: { artistId: null, OR: orContains },
        orderBy: { updatedAt: "desc" },
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

    for (const row of [...assigned, ...extra]) {
      collected.push({ ...row, profileId: user.id })
    }
  }

  // Дедуп общий: один и тот же плейлист может найтись у двух профилей группы.
  const merged = dedupePlaylistsByUrlAndName(collected, artistId)
  merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  const profileById = new Map(members.map((m) => [m.id, m]))
  return merged.map((row) => {
    const profileId = (row as PlaylistListRow & { profileId?: string }).profileId ?? artistId
    return mapPrismaPlaylistToArtistItem(row, profileById.get(profileId) ?? { id: profileId })
  })
}

export const getCachedArtistPlaylists = unstable_cache(
  async (artistId: string) => loadArtistPlaylistsUncached(artistId),
  ["artist-playlists-v4"],
  // H2: без тега привязку плейлиста нельзя было сбросить — артист не видел
  // новый плейлист до истечения revalidate.
  { revalidate: DASHBOARD_REVALIDATE_SEC, tags: [CACHE_TAG_ARTIST_PLAYLISTS] }
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

export type AdminReleaseItem = Release

async function loadAdminReleasesUncached(): Promise<AdminReleaseItem[]> {
  const rows = await prisma.release.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map(releaseFromPrisma)
}
