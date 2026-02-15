import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
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

export interface User {
  id: string
  username: string
  name: string
  email: string
  role: 'admin' | 'artist'
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

const DATA_DIR = path.join(process.cwd(), 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const RELEASES_FILE = path.join(DATA_DIR, 'releases.json')
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json')
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json')

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(RELEASES_FILE)) {
  fs.writeFileSync(RELEASES_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(REPORTS_FILE)) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2))
}

if (!fs.existsSync(ACTIVITIES_FILE)) {
  fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify([], null, 2))
}

export async function loadUsers(): Promise<User[]> {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return users.map(userFromPrisma)
  } catch (error) {
    console.error('Error loading users:', error)
    return []
  }
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

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  try {
    // Хешируем пароль если он обновляется и ещё не захеширован
    let updateData: any = { ...updates }
    if (updates.password && !updates.password.startsWith('$2')) {
      updateData.password = bcrypt.hashSync(updates.password, 10)
    }
    
    // Удаляем поля которых нет в схеме Prisma
    delete updateData.id
    delete updateData.createdAt
    
    const prismaUser = await prisma.user.update({
      where: { id },
      data: updateData
    })
    
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
    return null
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    return user ? userFromPrisma(user) : null
  } catch (error) {
    console.error('Error getting user by username:', error)
    return null
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const user = await prisma.user.findFirst({ where: { email } })
    return user ? userFromPrisma(user) : null
  } catch (error) {
    console.error('Error getting user by email:', error)
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
  
  return releaseFromPrisma(prismaRelease)
}

export async function updateRelease(id: string, updates: Partial<Release>): Promise<Release | null> {
  try {
    let updateData: any = { ...updates }
    
    // Удаляем поля которых нет в схеме или которые не должны обновляться
    delete updateData.id
    delete updateData.createdAt
    
    // Если есть tracks, преобразуем в JSON
    if (updateData.tracks) {
      updateData.tracks = updateData.tracks as any
    }
    
    const prismaRelease = await prisma.release.update({
      where: { id },
      data: updateData
    })
    
    return releaseFromPrisma(prismaRelease)
  } catch (error) {
    console.error('Error updating release:', error)
    return null
  }
}

export async function deleteRelease(id: string): Promise<boolean> {
  try {
    await prisma.release.delete({ where: { id } })
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
  const releases = await loadReleases()
  return releases.filter(release => {
    // Check if artist is main artist
    if (release.artistId === artistId) return true
    
    // Check if artist is featured in the release
    if (release.featuredArtistIds?.includes(artistId)) return true
    
    // Check if artist is featured in any track
    return release.tracks.some(track => 
      track.featuredArtistIds?.includes(artistId)
    )
  })
}

// Helper function to get releases where artist is featured
export async function getFeaturedReleases(artistId: string): Promise<Release[]> {
  const releases = await loadReleases()
  return releases.filter(release => {
    // Check if artist is featured in the release (but not main artist)
    if (release.artistId !== artistId && release.featuredArtistIds?.includes(artistId)) {
      return true
    }
    
    // Check if artist is featured in any track
    return release.tracks.some(track => 
      track.featuredArtistIds?.includes(artistId)
    )
  })
}

// Helper function to get all releases with their artist info
export async function getReleasesWithArtists(): Promise<(Release & { artist: User | null })[]> {
  const releases = await loadReleases()
  const users = await loadUsers()
  
  return releases.map(release => ({
    ...release,
    artist: users.find(user => user.id === release.artistId) || null
  }))
}

// Assign existing unassigned reports to new artist by name matching
// Helper to normalize artist names for matching
export function normalizeArtistName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

// Find artist by name or username (case-insensitive)
export async function findArtistByName(name: string): Promise<User | null> {
  const users = await loadUsers()
  const normalized = normalizeArtistName(name)
  return users.find(u => {
    if (u.role !== 'artist') return false
    if (normalizeArtistName(u.name) === normalized) return true
    if (normalizeArtistName(u.username) === normalized) return true
    return false
  }) || null
}

// Assign existing unassigned reports to new artist by name matching
export async function assignReportsToNewArtist(artistId: string, artistName: string): Promise<number> {
  const reports = await loadReports()
  const normalizedName = normalizeArtistName(artistName)
  const toUpdate = reports.filter(r =>
    !r.artistId && r.artistName && normalizeArtistName(r.artistName) === normalizedName
  )
  
  if (toUpdate.length === 0) return 0
  
  // Обновляем каждый отчёт
  await Promise.all(
    toUpdate.map(r =>
      prisma.report.update({
        where: { id: r.id },
        data: { artistId, isRegistered: true }
      })
    )
  )
  
  return toUpdate.length
}

// Assign existing releases to new artist by name matching
export async function assignReleasesToNewArtist(artistId: string, artistName: string, username: string): Promise<number> {
  const releases = await loadReleases()
  const normalizedName = normalizeArtistName(artistName)
  const normalizedUsername = normalizeArtistName(username)
  
  const toUpdate = releases.filter(release => {
    if (release.artistId) return false
    const releaseArtistName = (release as any).artistName || ''
    return normalizeArtistName(releaseArtistName) === normalizedName ||
           normalizeArtistName(releaseArtistName) === normalizedUsername
  })
  
  if (toUpdate.length === 0) return 0
  
  // Обновляем каждый релиз
  await Promise.all(
    toUpdate.map(r =>
      prisma.release.update({
        where: { id: r.id },
        data: { artistId }
      })
    )
  )
  
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
export interface ReportData extends Report {
  year?: number
  totalPlays?: number
  totalAmount?: number
  isPaid?: boolean
  isSigned?: boolean
  isRegistered?: boolean
  status?: string
  uploadDate?: string
}

// Функция для получения баланса артиста
export async function getArtistBalance(artistId: string): Promise<ArtistBalance> {
  const reports = (await loadReports()).filter(r => r.artistId === artistId)
  
  // Считаем общий баланс из всех отчетов
  const totalBalance = reports.reduce((sum, report) => {
    const amount = (report as any).totalAmount || 0
    return sum + amount
  }, 0)
  
  // Считаем уже выплаченную сумму
  const paidAmount = reports
    .filter(r => (r as any).isPaid === true)
    .reduce((sum, report) => {
      const amount = (report as any).totalAmount || 0
      return sum + amount
    }, 0)
  
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
  const users = await loadUsers()
  return artistNames
    .map(name => users.find(u => 
      u.role === 'artist' && 
      u.name.toLowerCase() === name.toLowerCase()
    ))
    .filter((user): user is User => user !== undefined)
}

// Функция для поиска всех артистов по имени (частичное совпадение)
export async function findArtistsByPartialName(partialName: string): Promise<User[]> {
  const users = await loadUsers()
  const searchName = partialName.toLowerCase()
  return users.filter(u => 
    u.role === 'artist' && 
    u.name.toLowerCase().includes(searchName)
  )
}