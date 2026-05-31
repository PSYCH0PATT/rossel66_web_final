
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { 
  userFromPrisma, 
  releaseFromPrisma, 
  reportFromPrisma, 
  activityFromPrisma,
  userToPrismaCreate,
  releaseToPrismaCreate,
  reportToPrismaCreate,
  activityToPrismaCreate
} from './storage-adapters'
import { revalidateArtistDashboardsForArtistIds } from './revalidate-artist-dashboard'
import { releaseDateToSortDate } from '@/lib/release-date-sort'

/** Не превращать сбой БД (неверный DATABASE_URL и т.д.) в «пользователь не найден». */
function isInfrastructureDbError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_INFRA_ERROR_CODES.has(error.code)
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true
  }
  return false
}

/** Коды Prisma: подключение / строка URL / доступ (не бизнес-логика запроса). */
const PRISMA_INFRA_ERROR_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1009',
  'P1010',
  'P1011',
  'P1012',
  'P1013',
  'P1014',
  'P1015',
  'P1016',
  'P1017',
])

export type UserRole = 'admin' | 'artist'

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: UserRole
  password: string
  createdAt: string
  avatarUrl?: string
  vkMusicUrl?: string
  yandexMusicUrl?: string
  spotifyUrl?: string
  // Новые поля для артистов
  fio?: string
  fioShort?: string
  contract?: string
  percentage?: number
  updatedAt?: string
  verified?: boolean
}

// Статусы релизов из Koala Music
export type ReleaseStatus = 
  | 'На модерации' 
  | 'Одобрен' 
  | 'Отклонён' 
  | 'В доставке' 
  | 'Доставлен' 
  | 'Снят'
  // Legacy статусы для обратной совместимости
  | 'released' 
  | 'moderation' 
  | 'delivery' 
  | 'scheduled'

export interface Release {
  id: string
  title: string
  artistId: string
  releaseDate: string
  type?: 'single' | 'album' | 'ep'
  coverUrl?: string
  tracks: Track[]
  createdAt: string
  updatedAt: string
  upc?: string
  status?: ReleaseStatus | string
  featuredArtistIds?: string[]
  featuredArtistNames?: string[]
  // Новые поля для Koala Music
  koalaId?: string          // ID релиза в Koala Music
  bandlinkUrl?: string      // Ссылка BandLink
}

export interface Track {
  id: string
  title: string
  duration: string
  trackNumber?: number
  isrc?: string              // ISRC код трека
  featuredArtistIds?: string[]
  featuredArtistNames?: string[]
  royaltyShares?: Record<string, number>  // Доли роялти: { "artistName": 60, "otherArtist": 40 } (в процентах)
}

export interface Report {
  id: string
  quarter: string
  artistId: string
  artistName: string
  fileName: string
  filePath: string
  uploadedAt: string
  processed: boolean
  year?: number
  totalPlays?: number
  totalAmount?: number
  isPaid?: boolean
  isSigned?: boolean
  isRegistered?: boolean
  status?: 'processed' | 'pending'
  uploadDate?: string
  fileUrl?: string
}

export type ActivityType =
  | 'release_added'
  | 'playlist_found'
  | 'report_received'
  | 'payment_sent'
  | 'user_data_updated'
  | 'reports_generated'
  | 'artist_added'
  | 'artist_removed'
  | 'release_status_updated'
  | 'parser_started'
  | 'parser_completed'
  | 'parser_error'
  | 'parser_release_found'
  | 'parser_release_updated'
  | 'analytics_import'
  | 'analytics_cleanup'
  | 'parser_playlist_found'
  | 'artist_auto_created'
  | 'report_status_changed'

export interface Activity {
  id: string
  type: ActivityType
  userId: string
  userRole: 'artist' | 'admin'
  title: string
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

const ACTIVITY_RETENTION_DAYS = 90


export async function loadUsers(): Promise<User[]> {
  const dbStart = performance.now()
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
  const dbMs = Math.round(performance.now() - dbStart)
  if (dbMs > 100) console.log(`[LOGIN_DEBUG] loadUsers prisma.user.findMany: ${dbMs}ms (медленно)`)
  else console.log(`[LOGIN_DEBUG] loadUsers prisma.user.findMany: ${dbMs}ms`)
  return users.map(userFromPrisma)
}

// saveUsers больше не нужна - используйте updateUser для изменений
export async function saveUsers(users: User[]): Promise<void> {
  console.warn('saveUsers() deprecated - use updateUser() instead')
}

export async function loadReleases(): Promise<Release[]> {
  try {
    const releases = await prisma.release.findMany({ orderBy: { createdAt: 'desc' } })
    return releases.map(releaseFromPrisma)
  } catch (error) {
    console.error('Error loading releases:', error)
    return []
  }
}

// saveReleases больше не нужна - используйте updateRelease для изменений
export async function saveReleases(releases: Release[]): Promise<void> {
  console.warn('saveReleases() deprecated - use updateRelease() or direct prisma calls')
}

export async function addUser(user: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  // Хешируем пароль если он ещё не захеширован
  let hashedPassword = user.password
  if (user.password && !user.password.startsWith('$2')) {
    hashedPassword = bcrypt.hashSync(user.password, 10)
  }
  
  const data = userToPrismaCreate({ ...user, password: hashedPassword })
  const prismaUser = await prisma.user.create({
    data: {
      ...data,
      id: Date.now().toString(),
    }
  })
  
  return userFromPrisma(prismaUser)
}

function toUserUpdateInput(updates: Partial<User>): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {}
  if (updates.username !== undefined) data.username = updates.username
  if (updates.name !== undefined) data.name = updates.name
  if (updates.email !== undefined) data.email = updates.email
  if (updates.role !== undefined) data.role = updates.role
  if (updates.avatarUrl !== undefined) data.avatarUrl = updates.avatarUrl
  if (updates.vkMusicUrl !== undefined) data.vkMusicUrl = updates.vkMusicUrl
  if (updates.yandexMusicUrl !== undefined) data.yandexMusicUrl = updates.yandexMusicUrl
  if (updates.spotifyUrl !== undefined) data.spotifyUrl = updates.spotifyUrl
  if (updates.fio !== undefined) data.fio = updates.fio
  if (updates.fioShort !== undefined) data.fioShort = updates.fioShort
  if (updates.contract !== undefined) data.contract = updates.contract
  if (updates.percentage !== undefined) data.percentage = updates.percentage
  if (updates.verified !== undefined) data.verified = updates.verified
  if (updates.password !== undefined) {
    data.password = updates.password.startsWith('$2')
      ? updates.password
      : bcrypt.hashSync(updates.password, 10)
  }
  return data
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  try {
    const data = toUserUpdateInput(updates)
    if (Object.keys(data).length === 0) {
      const u = await prisma.user.findUnique({ where: { id } })
      return u ? userFromPrisma(u) : null
    }

    const prismaUser = await prisma.user.update({
      where: { id },
      data,
    })

    await revalidateArtistDashboardsForArtistIds([id])

    return userFromPrisma(prismaUser)
  } catch (error) {
    console.error('Error updating user:', error)
    return null
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    await prisma.user.delete({ where: { id } })
    return true
  } catch (error) {
    console.error('Error deleting user:', error)
    return false
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    return user ? userFromPrisma(user) : null
  } catch (error) {
    console.error('Error getting user by id:', error)
    if (isInfrastructureDbError(error)) throw error
    return null
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    return user ? userFromPrisma(user) : null
  } catch (error) {
    console.error('Error getting user by username:', error)
    if (isInfrastructureDbError(error)) throw error
    return null
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findFirst({ where: { email } })
    return user ? userFromPrisma(user) : null
  } catch (error) {
    console.error('Error getting user by email:', error)
    if (isInfrastructureDbError(error)) throw error
    return null
  }
}

export async function addRelease(release: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>): Promise<Release> {
  const data = releaseToPrismaCreate(release)
  const prismaRelease = await prisma.release.create({
    data: {
      ...data,
      id: Date.now().toString(),
    }
  })

  await revalidateArtistDashboardsForArtistIds([
    prismaRelease.artistId,
    ...(prismaRelease.featuredArtistIds ?? []),
  ])
  
  return releaseFromPrisma(prismaRelease)
}

/** Атомарно: создать релиз и записи activity (без частичного состояния). */
export async function addReleaseWithActivities(
  release: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>,
  buildActivities: (created: Release) => Omit<Activity, 'id' | 'createdAt'>[]
): Promise<Release> {
  const releaseId = `release_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const data = releaseToPrismaCreate(release)
  const prismaRelease = await prisma.$transaction(async (tx) => {
    const createdRow = await tx.release.create({
      data: { ...data, id: releaseId },
    })
    const created = releaseFromPrisma(createdRow)
    let idx = 0
    for (const act of buildActivities(created)) {
      const ad = activityToPrismaCreate(act)
      await tx.activity.create({
        data: {
          ...ad,
          id: `activity_${Date.now()}_${idx++}_${Math.random().toString(36).slice(2, 9)}`,
        },
      })
    }
    return createdRow
  })

  await revalidateArtistDashboardsForArtistIds([
    prismaRelease.artistId,
    ...(prismaRelease.featuredArtistIds ?? []),
  ])
  await trimActivitiesOlderThanDays(ACTIVITY_RETENTION_DAYS)

  return releaseFromPrisma(prismaRelease)
}

function toReleaseUpdateInput(updates: Partial<Release>): Prisma.ReleaseUpdateInput {
  const data: Prisma.ReleaseUpdateInput = {}
  if (updates.title !== undefined) data.title = updates.title
  if (updates.artistId !== undefined) data.artistId = updates.artistId || null
  if (updates.releaseDate !== undefined) {
    data.releaseDate = updates.releaseDate
    data.releaseDateSort = releaseDateToSortDate(updates.releaseDate)
  }
  if (updates.type !== undefined) data.type = updates.type
  if (updates.coverUrl !== undefined) data.coverUrl = updates.coverUrl
  if (updates.tracks !== undefined)
    data.tracks = updates.tracks as unknown as Prisma.InputJsonValue
  if (updates.upc !== undefined) data.upc = updates.upc
  if (updates.status !== undefined) data.status = updates.status
  if (updates.featuredArtistIds !== undefined) data.featuredArtistIds = updates.featuredArtistIds
  if (updates.featuredArtistNames !== undefined) data.featuredArtistNames = updates.featuredArtistNames
  if (updates.koalaId !== undefined) data.koalaId = updates.koalaId
  if (updates.bandlinkUrl !== undefined) data.bandlinkUrl = updates.bandlinkUrl
  return data
}

export async function updateRelease(id: string, updates: Partial<Release>): Promise<Release | null> {
  try {
    const existing = await prisma.release.findUnique({
      where: { id },
      select: { artistId: true, featuredArtistIds: true, metadata: true },
    })

    const data = toReleaseUpdateInput(updates)

    const known = new Set([
      'title', 'artistId', 'releaseDate', 'type', 'coverUrl', 'tracks', 'upc', 'status',
      'featuredArtistIds', 'featuredArtistNames', 'koalaId', 'bandlinkUrl', 'id', 'createdAt', 'updatedAt',
    ])
    const metaPatch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(updates as Record<string, unknown>)) {
      if (!known.has(k) && k !== 'artistName' && v !== undefined) {
        metaPatch[k] = v
      }
    }
    if (Object.keys(metaPatch).length > 0) {
      const prev = (existing?.metadata as Record<string, unknown> | null) || {}
      data.metadata = { ...prev, ...metaPatch } as Prisma.InputJsonValue
    }

    if (Object.keys(data).length === 0) {
      const r = await prisma.release.findUnique({ where: { id } })
      return r ? releaseFromPrisma(r) : null
    }

    const prismaRelease = await prisma.release.update({
      where: { id },
      data,
    })

    const touchedIds = [
      existing?.artistId,
      ...(existing?.featuredArtistIds ?? []),
      prismaRelease.artistId,
      ...(prismaRelease.featuredArtistIds ?? []),
    ]
    await revalidateArtistDashboardsForArtistIds(touchedIds)
    
    return releaseFromPrisma(prismaRelease)
  } catch (error) {
    console.error('Error updating release:', error)
    return null
  }
}

export async function deleteRelease(id: string): Promise<boolean> {
  try {
    const existing = await prisma.release.findUnique({
      where: { id },
      select: { artistId: true, featuredArtistIds: true },
    })
    await prisma.release.delete({ where: { id } })
    await revalidateArtistDashboardsForArtistIds([
      existing?.artistId,
      ...(existing?.featuredArtistIds ?? []),
    ])
    return true
  } catch (error) {
    console.error('Error deleting release:', error)
    return false
  }
}

export async function getReleaseById(id: string): Promise<Release | null> {
  try {
    const release = await prisma.release.findUnique({ where: { id } })
    return release ? releaseFromPrisma(release) : null
  } catch (error) {
    console.error('Error getting release by id:', error)
    return null
  }
}

export async function getReleasesByArtistId(artistId: string): Promise<Release[]> {
  try {
    const releases = await prisma.release.findMany({ 
      where: { artistId },
      orderBy: { createdAt: 'desc' }
    })
    return releases.map(releaseFromPrisma)
  } catch (error) {
    console.error('Error getting releases by artist id:', error)
    return []
  }
}

export async function getAllReleases(): Promise<Release[]> {
  return loadReleases()
}

export async function getAllUsers(): Promise<User[]> {
  return loadUsers()
}

// Helper function to get artist releases including featured releases
export async function getArtistReleases(artistId: string): Promise<Release[]> {
  const rows = await prisma.release.findMany({
    where: {
      OR: [{ artistId }, { featuredArtistIds: { has: artistId } }],
    },
    orderBy: { createdAt: "desc" },
  })
  const releases = rows.map(releaseFromPrisma)
  return releases.filter((release) => {
    if (release.artistId === artistId) return true
    if (release.featuredArtistIds?.includes(artistId)) return true
    return release.tracks.some((track) => track.featuredArtistIds?.includes(artistId))
  })
}

// Helper function to get releases where artist is featured (not as main artist)
export async function getFeaturedReleases(artistId: string): Promise<Release[]> {
  const all = await getArtistReleases(artistId)
  return all.filter((r) => r.artistId !== artistId)
}

// Helper function to get all releases with their artist info
export async function getReleasesWithArtists(): Promise<(Release & { artist: User | null })[]> {
  const [releaseRows, userRows] = await Promise.all([
    prisma.release.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ])
  const users = userRows.map(userFromPrisma)
  const userById = new Map(users.map((u) => [u.id, u]))
  return releaseRows.map((r) => {
    const release = releaseFromPrisma(r)
    return {
      ...release,
      artist: release.artistId ? userById.get(release.artistId) ?? null : null,
    }
  })
}

// Assign existing unassigned reports to new artist by name matching
// Helper to normalize artist names for matching
export function normalizeArtistName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Find artist by name or username (case-insensitive)
export async function findArtistByName(name: string): Promise<User | null> {
  const normalized = normalizeArtistName(name)
  const rows = await prisma.user.findMany({ where: { role: "artist" } })
  for (const row of rows) {
    const u = userFromPrisma(row)
    if (normalizeArtistName(u.name) === normalized || normalizeArtistName(u.username) === normalized) {
      return u
    }
  }
  return null
}

// Assign existing unassigned reports to new artist by name matching
export async function assignReportsToNewArtist(artistId: string, artistName: string): Promise<number> {
  const normalizedName = normalizeArtistName(artistName)
  const candidates = await prisma.report.findMany({
    where: { artistId: null },
  })
  const toUpdate = candidates.filter(
    (r) => r.artistName && normalizeArtistName(r.artistName) === normalizedName
  )
  if (toUpdate.length === 0) return 0

  await prisma.report.updateMany({
    where: { id: { in: toUpdate.map((r) => r.id) } },
    data: { artistId, isRegistered: true },
  })

  return toUpdate.length
}

// Assign existing releases to new artist by name matching
export async function assignReleasesToNewArtist(artistId: string, artistName: string, username: string): Promise<number> {
  const releaseRows = await prisma.release.findMany({ orderBy: { updatedAt: "desc" } })
  const releases = releaseRows.map(releaseFromPrisma)
  const artistIds = [...new Set(releases.map((r) => r.artistId).filter(Boolean))] as string[]
  const existingRows =
    artistIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: artistIds } } })
      : []
  const existingById = new Map(existingRows.map((row) => [row.id, userFromPrisma(row)]))

  const normalizedName = normalizeArtistName(artistName)

  const toUpdate = releases.filter((release) => {
    const releaseArtistName = (release as { artistName?: string }).artistName || ""
    if (!releaseArtistName) return false

    const artists = releaseArtistName.split(",").map((a: string) => a.trim())
    const mainArtist = artists[0]
    const normalizedMainArtist = normalizeArtistName(mainArtist)

    if (normalizedMainArtist !== normalizedName) return false

    if (release.artistId && existingById.has(release.artistId)) {
      return false
    }

    return true
  })

  if (toUpdate.length === 0) return 0

  await prisma.$transaction(
    toUpdate.map((r) =>
      prisma.release.update({
        where: { id: r.id },
        data: { artistId },
      })
    )
  )

  await revalidateArtistDashboardsForArtistIds([artistId])

  return toUpdate.length
}

// Reports functions
export async function loadReports(): Promise<Report[]> {
  try {
    const reports = await prisma.report.findMany({ orderBy: { uploadedAt: 'desc' } })
    return reports.map(reportFromPrisma)
  } catch (error) {
    console.error('Error loading reports:', error)
    return []
  }
}

// saveReports больше не нужна - используйте прямые update через prisma
export async function saveReports(reports: Report[]): Promise<void> {
  console.warn('saveReports() deprecated - use direct prisma updates')
}

// Activities functions
export async function loadActivities(): Promise<Activity[]> {
  try {
    const activities = await prisma.activity.findMany({ orderBy: { createdAt: 'desc' } })
    return activities.map(activityFromPrisma)
  } catch (error) {
    console.error('Error loading activities:', error)
    return []
  }
}

// saveActivities больше не нужна
export async function saveActivities(activities: Activity[]): Promise<void> {
  console.warn('saveActivities() deprecated - use direct prisma updates')
}

export async function trimActivitiesOlderThanDays(days: number): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  
  try {
    await prisma.activity.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    })
  } catch (error) {
    console.error('Error trimming activities:', error)
  }
}

export async function addActivity(activity: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
  const data = activityToPrismaCreate(activity)
  const prismaActivity = await prisma.activity.create({
    data: {
      ...data,
      id: Date.now().toString(),
    }
  })
  
  // Trim old activities
  await trimActivitiesOlderThanDays(ACTIVITY_RETENTION_DAYS)
  
  return activityFromPrisma(prismaActivity)
}

export interface ActivityFilters {
  userId?: string
  role?: 'artist' | 'admin'
  types?: ActivityType[]
  dateFrom?: string
  dateTo?: string
}

export async function getActivitiesFiltered(
  filters: ActivityFilters,
  limit: number = 50,
  offset: number = 0
): Promise<{ activities: Activity[]; total: number }> {
  const where: any = {}
  
  if (filters.userId) {
    where.userId = filters.userId
  }
  if (filters.role) {
    where.userRole = filters.role
  }
  if (filters.types?.length) {
    where.type = { in: filters.types }
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
  }
  
  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    }),
    prisma.activity.count({ where })
  ])
  
  return { 
    activities: activities.map(activityFromPrisma), 
    total 
  }
}

export async function getActivitiesByUserId(userId: string, limit: number = 10): Promise<Activity[]> {
  const activities = await prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return activities.map(activityFromPrisma)
}

export async function getActivitiesByRole(role: 'artist' | 'admin', limit: number = 10): Promise<Activity[]> {
  const activities = await prisma.activity.findMany({
    where: { userRole: role },
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return activities.map(activityFromPrisma)
}

export async function getAllActivities(limit: number = 50): Promise<Activity[]> {
  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  })
  return activities.map(activityFromPrisma)
}

// ============================================================
// Дополнительные функции для работы с отчетами и балансами
// ============================================================

// Интерфейс для баланса артиста
export interface ArtistBalance {
  artistId: string
  totalBalance: number
  availableForPayout: number
  lastUpdated: string
}

// Расширенный интерфейс отчета с дополнительными полями
export interface ReportData extends Omit<Report, 'status'> {
  year?: number
  totalPlays?: number
  totalAmount?: number
  isPaid?: boolean
  isSigned?: boolean
  isRegistered?: boolean
  status?: Report['status']
  uploadDate?: string
}

// Функция для получения баланса артиста
export async function getArtistBalance(artistId: string): Promise<ArtistBalance> {
  const [totalAgg, paidAgg] = await Promise.all([
    prisma.report.aggregate({
      where: { artistId },
      _sum: { totalAmount: true },
    }),
    prisma.report.aggregate({
      where: { artistId, isPaid: true },
      _sum: { totalAmount: true },
    }),
  ])

  const totalBalance = totalAgg._sum.totalAmount ?? 0
  const paidAmount = paidAgg._sum.totalAmount ?? 0

  // Доступно к выплате = общий баланс минус выплаченное
  // Минимальная сумма для выплаты 3000 рублей
  const unpaidBalance = totalBalance - paidAmount
  const availableForPayout = unpaidBalance >= 3000 ? unpaidBalance : 0

  return {
    artistId,
    totalBalance,
    availableForPayout,
    lastUpdated: new Date().toISOString()
  }
}

// Алиас для getReleasesByArtistId (для совместимости)
export async function getReleasesByArtist(artistId: string): Promise<Release[]> {
  return getReleasesByArtistId(artistId)
}

// Функция для перемещения отчета к артисту
export async function moveReportToArtist(reportId: string, artistId: string): Promise<boolean> {
  try {
    const artist = await getUserById(artistId)
    await prisma.report.update({
      where: { id: reportId },
      data: { 
        artistId,
        artistName: artist?.name || ''
      }
    })
    return true
  } catch (error) {
    console.error('Error moving report to artist:', error)
    return false
  }
}

// Функция для обновления статуса подписи отчета
export async function updateReportSignedStatus(reportId: string, isSigned: boolean): Promise<boolean> {
  try {
    await prisma.report.update({
      where: { id: reportId },
      data: { isSigned }
    })
    return true
  } catch (error) {
    console.error('Error updating report signed status:', error)
    return false
  }
}

// Функция для обновления статуса оплаты отчета
export async function updateReportPaidStatus(reportId: string, isPaid: boolean): Promise<boolean> {
  try {
    await prisma.report.update({
      where: { id: reportId },
      data: { isPaid }
    })
    return true
  } catch (error) {
    console.error('Error updating report paid status:', error)
    return false
  }
}

// Функция для назначения отчетов артисту (алиас для совместимости)
export async function assignReportsToArtist(artistId: string, artistName: string): Promise<void> {
  await assignReportsToNewArtist(artistId, artistName)
}

// Функция для добавления отчета (если нужна)
export async function addReport(report: Omit<ReportData, 'id' | 'uploadedAt'>): Promise<ReportData> {
  const data = reportToPrismaCreate(report)
  const prismaReport = await prisma.report.create({
    data: {
      ...data,
      id: Date.now().toString(),
    }
  })
  
  return reportFromPrisma(prismaReport) as ReportData
}

// ============================================================
// Функции для Koala Music Parser
// ============================================================

// Функция для поиска релиза по Koala ID
export async function getReleaseByKoalaId(koalaId: string): Promise<Release | null> {
  try {
    const release = await prisma.release.findFirst({ where: { koalaId } })
    return release ? releaseFromPrisma(release) : null
  } catch (error) {
    console.error('Error getting release by koala id:', error)
    return null
  }
}

// Функция для поиска артистов по именам
export async function findArtistsByNames(artistNames: string[]): Promise<User[]> {
  if (artistNames.length === 0) return []
  const rows = await prisma.user.findMany({
    where: {
      role: "artist",
      OR: artistNames.map((n) => ({ name: { equals: n, mode: "insensitive" } })),
    },
  })
  const users = rows.map(userFromPrisma)
  return artistNames
    .map((name) => users.find((u) => u.name.toLowerCase() === name.toLowerCase()))
    .filter((u): u is User => u !== undefined)
}

// Функция для поиска всех артистов по имени (частичное совпадение)
export async function findArtistsByPartialName(partialName: string): Promise<User[]> {
  const searchName = partialName.toLowerCase()
  const rows = await prisma.user.findMany({
    where: {
      role: "artist",
      name: { contains: searchName, mode: "insensitive" },
    },
  })
  return rows.map(userFromPrisma)
}