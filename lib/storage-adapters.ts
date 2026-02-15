import type { User as PrismaUser, Release as PrismaRelease, Report as PrismaReport, Activity as PrismaActivity } from '@prisma/client'
import type { User, Release, Report, Activity, Track } from './storage'

/**
 * Адаптеры для преобразования типов Prisma в типы Storage
 * Prisma возвращает Date объекты, а текущий код ожидает string (ISO 8601)
 */

export function userFromPrisma(prismaUser: PrismaUser): User {
  return {
    id: prismaUser.id,
    username: prismaUser.username,
    name: prismaUser.name,
    email: prismaUser.email,
    role: prismaUser.role as 'admin' | 'artist',
    password: prismaUser.password,
    createdAt: prismaUser.createdAt.toISOString(),
    updatedAt: prismaUser.updatedAt.toISOString(),
    avatarUrl: prismaUser.avatarUrl ?? undefined,
    vkMusicUrl: prismaUser.vkMusicUrl ?? undefined,
    yandexMusicUrl: prismaUser.yandexMusicUrl ?? undefined,
    spotifyUrl: prismaUser.spotifyUrl ?? undefined,
    fio: prismaUser.fio ?? undefined,
    fioShort: prismaUser.fioShort ?? undefined,
    contract: prismaUser.contract ?? undefined,
    percentage: prismaUser.percentage ?? undefined,
    verified: prismaUser.verified ?? true,
  }
}

export function releaseFromPrisma(prismaRelease: PrismaRelease): Release {
  const tracks = prismaRelease.tracks as Track[]
  const metadata = prismaRelease.metadata as Record<string, any> | null
  
  return {
    id: prismaRelease.id,
    title: prismaRelease.title,
    artistId: prismaRelease.artistId || '',
    releaseDate: prismaRelease.releaseDate,
    type: prismaRelease.type as 'single' | 'album' | 'ep' | undefined,
    coverUrl: prismaRelease.coverUrl ?? undefined,
    tracks,
    createdAt: prismaRelease.createdAt.toISOString(),
    updatedAt: prismaRelease.updatedAt.toISOString(),
    upc: prismaRelease.upc ?? undefined,
    status: prismaRelease.status ?? undefined,
    featuredArtistIds: prismaRelease.featuredArtistIds,
    featuredArtistNames: prismaRelease.featuredArtistNames,
    koalaId: prismaRelease.koalaId ?? undefined,
    bandlinkUrl: prismaRelease.bandlinkUrl ?? undefined,
    // Дополнительные поля из metadata (artistName, genre, platforms, zvonko_data и т.д.)
    ...(metadata || {})
  }
}

export function reportFromPrisma(prismaReport: PrismaReport): Report {
  return {
    id: prismaReport.id,
    quarter: prismaReport.quarter,
    artistId: prismaReport.artistId || '',
    artistName: prismaReport.artistName,
    fileName: prismaReport.fileName,
    filePath: prismaReport.filePath,
    uploadedAt: prismaReport.uploadedAt.toISOString(),
    processed: prismaReport.processed,
    year: prismaReport.year ?? undefined,
    totalPlays: prismaReport.totalPlays ?? undefined,
    totalAmount: prismaReport.totalAmount ?? undefined,
    isPaid: prismaReport.isPaid ?? undefined,
    isSigned: prismaReport.isSigned ?? undefined,
    isRegistered: prismaReport.isRegistered ?? undefined,
    status: prismaReport.status as 'processed' | 'pending' | undefined,
    uploadDate: prismaReport.uploadDate ?? undefined,
    fileUrl: prismaReport.fileUrl ?? undefined,
  }
}

export function activityFromPrisma(prismaActivity: PrismaActivity): Activity {
  return {
    id: prismaActivity.id,
    type: prismaActivity.type,
    userId: prismaActivity.userId ?? undefined,
    userRole: prismaActivity.userRole as 'artist' | 'admin',
    title: prismaActivity.title,
    description: prismaActivity.description,
    metadata: prismaActivity.metadata as Record<string, any> | undefined,
    createdAt: prismaActivity.createdAt.toISOString(),
  }
}

/**
 * Обратные преобразования для создания/обновления записей
 */

export function userToPrismaCreate(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
  return {
    username: user.username,
    name: user.name,
    email: user.email || '',
    role: user.role,
    password: user.password,
    avatarUrl: user.avatarUrl,
    vkMusicUrl: user.vkMusicUrl,
    yandexMusicUrl: user.yandexMusicUrl,
    spotifyUrl: user.spotifyUrl,
    fio: user.fio,
    fioShort: user.fioShort,
    contract: user.contract,
    percentage: user.percentage,
    verified: user.verified ?? true,
  }
}

export function releaseToPrismaCreate(release: Omit<Release, 'id' | 'createdAt' | 'updatedAt'>) {
  // Отделяем известные поля от metadata
  const { 
    title, artistId, releaseDate, type, coverUrl, tracks, upc, status, 
    featuredArtistIds, featuredArtistNames, koalaId, bandlinkUrl,
    ...metadata 
  } = release
  
  return {
    title,
    artistId: artistId || null,
    releaseDate,
    type,
    coverUrl,
    upc,
    status,
    koalaId,
    bandlinkUrl,
    tracks: tracks as any,
    featuredArtistIds: featuredArtistIds || [],
    featuredArtistNames: featuredArtistNames || [],
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  }
}

export function reportToPrismaCreate(report: Omit<Report, 'id' | 'uploadedAt'>) {
  return {
    quarter: report.quarter,
    artistId: report.artistId || null,
    artistName: report.artistName,
    fileName: report.fileName,
    filePath: report.filePath,
    processed: report.processed ?? true,
    year: report.year,
    totalPlays: report.totalPlays,
    totalAmount: report.totalAmount,
    isPaid: report.isPaid,
    isSigned: report.isSigned,
    isRegistered: report.isRegistered,
    status: report.status,
    uploadDate: report.uploadDate,
    fileUrl: report.fileUrl,
  }
}

export function activityToPrismaCreate(activity: Omit<Activity, 'id' | 'createdAt'>) {
  return {
    type: activity.type,
    userId: activity.userId || null,
    userRole: activity.userRole,
    title: activity.title,
    description: activity.description,
    metadata: activity.metadata as any,
  }
}
