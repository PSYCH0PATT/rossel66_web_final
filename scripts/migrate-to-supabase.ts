#!/usr/bin/env ts-node

/**
 * Скрипт для переноса данных из JSON файлов в Supabase через Prisma
 * Запуск: npx tsx scripts/migrate-to-supabase.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'
import { prisma } from '../lib/prisma'

interface JsonUser {
  id: string
  username: string
  name: string
  email?: string
  role: 'admin' | 'artist'
  password: string
  createdAt?: string
  updatedAt?: string
  avatarUrl?: string
  vkMusicUrl?: string
  yandexMusicUrl?: string
  spotifyUrl?: string
  fio?: string
  fioShort?: string
  contract?: string
  percentage?: number
}

interface JsonRelease {
  id: string
  title: string
  artistId: string
  releaseDate: string
  type?: 'single' | 'album' | 'ep'
  coverUrl?: string
  tracks: any[]
  createdAt?: string
  updatedAt?: string
  upc?: string
  status?: string
  featuredArtistIds?: string[]
  featuredArtistNames?: string[]
  koalaId?: string
  bandlinkUrl?: string
  [key: string]: any
}

interface JsonReport {
  id: string
  quarter: string
  artistId?: string
  artistName: string
  fileName: string
  filePath: string
  uploadedAt?: string
  processed?: boolean
  year?: number
  totalPlays?: number
  totalAmount?: number
  isPaid?: boolean
  isSigned?: boolean
  isRegistered?: boolean
  status?: string
  uploadDate?: string
  fileUrl?: string
}

interface JsonActivity {
  id: string
  type: string
  userId?: string
  userRole: 'artist' | 'admin'
  title: string
  description: string
  metadata?: Record<string, any>
  createdAt?: string
}

const DATA_DIR = path.join(process.cwd(), 'data')

async function migrateUsers() {
  console.log('\n📥 Миграция пользователей...')
  const usersFile = path.join(DATA_DIR, 'users.json')
  
  if (!fs.existsSync(usersFile)) {
    console.log('⚠️  Файл users.json не найден, пропускаем')
    return
  }
  
  const users: JsonUser[] = JSON.parse(fs.readFileSync(usersFile, 'utf8'))
  console.log(`   Найдено пользователей: ${users.length}`)
  
  let created = 0
  let skipped = 0
  
  for (const u of users) {
    try {
      await prisma.user.create({
        data: {
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email || '',
          role: u.role,
          password: u.password,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
          avatarUrl: u.avatarUrl,
          vkMusicUrl: u.vkMusicUrl,
          yandexMusicUrl: u.yandexMusicUrl,
          spotifyUrl: u.spotifyUrl,
          fio: u.fio,
          fioShort: u.fioShort,
          contract: u.contract,
          percentage: u.percentage,
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`   ⚠️  Пользователь ${u.username} уже существует, пропускаем`)
        skipped++
      } else {
        console.error(`   ❌ Ошибка добавления ${u.username}:`, error.message)
      }
    }
  }
  
  console.log(`   ✅ Создано: ${created}, пропущено: ${skipped}`)
}

async function migrateReleases() {
  console.log('\n📥 Миграция релизов...')
  const releasesFile = path.join(DATA_DIR, 'releases.json')
  
  if (!fs.existsSync(releasesFile)) {
    console.log('⚠️  Файл releases.json не найден, пропускаем')
    return
  }
  
  const releases: JsonRelease[] = JSON.parse(fs.readFileSync(releasesFile, 'utf8'))
  console.log(`   Найдено релизов: ${releases.length}`)
  
  let created = 0
  let skipped = 0
  
  for (const r of releases) {
    try {
      // Стандартные поля для Release
      const { id, title, artistId, releaseDate, type, coverUrl, tracks, createdAt, updatedAt, upc, status, featuredArtistIds, featuredArtistNames, koalaId, bandlinkUrl, ...extra } = r
      
      // Остальное (artistName, genre, platforms, zvonko_data и т.д.) — в metadata
      await prisma.release.create({
        data: {
          id: r.id,
          title: r.title,
          artistId: r.artistId,
          releaseDate: r.releaseDate,
          type: r.type,
          coverUrl: r.coverUrl,
          upc: r.upc,
          status: r.status,
          koalaId: r.koalaId,
          bandlinkUrl: r.bandlinkUrl,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          tracks: r.tracks || [],
          featuredArtistIds: r.featuredArtistIds || [],
          featuredArtistNames: r.featuredArtistNames || [],
          metadata: Object.keys(extra).length > 0 ? extra : undefined,
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`   ⚠️  Релиз ${r.id} уже существует, пропускаем`)
        skipped++
      } else {
        console.error(`   ❌ Ошибка добавления релиза ${r.title}:`, error.message)
      }
    }
  }
  
  console.log(`   ✅ Создано: ${created}, пропущено: ${skipped}`)
}

async function migrateReports() {
  console.log('\n📥 Миграция отчётов...')
  const reportsFile = path.join(DATA_DIR, 'reports.json')
  
  if (!fs.existsSync(reportsFile)) {
    console.log('⚠️  Файл reports.json не найден, пропускаем')
    return
  }
  
  const reports: JsonReport[] = JSON.parse(fs.readFileSync(reportsFile, 'utf8'))
  console.log(`   Найдено отчётов: ${reports.length}`)
  
  let created = 0
  let skipped = 0
  
  for (const rep of reports) {
    try {
      await prisma.report.create({
        data: {
          id: rep.id,
          quarter: rep.quarter,
          artistId: rep.artistId || null,
          artistName: rep.artistName,
          fileName: rep.fileName,
          filePath: rep.filePath,
          uploadedAt: rep.uploadedAt ? new Date(rep.uploadedAt) : new Date(),
          processed: rep.processed ?? true,
          year: rep.year,
          totalPlays: rep.totalPlays,
          totalAmount: rep.totalAmount,
          isPaid: rep.isPaid,
          isSigned: rep.isSigned,
          isRegistered: rep.isRegistered,
          status: rep.status,
          uploadDate: rep.uploadDate,
          fileUrl: rep.fileUrl,
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`   ⚠️  Отчёт ${rep.id} уже существует, пропускаем`)
        skipped++
      } else {
        console.error(`   ❌ Ошибка добавления отчёта ${rep.id}:`, error.message)
      }
    }
  }
  
  console.log(`   ✅ Создано: ${created}, пропущено: ${skipped}`)
}

async function migrateActivities() {
  console.log('\n📥 Миграция активностей...')
  const activitiesFile = path.join(DATA_DIR, 'activities.json')
  
  if (!fs.existsSync(activitiesFile)) {
    console.log('⚠️  Файл activities.json не найден, пропускаем')
    return
  }
  
  const activities: JsonActivity[] = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'))
  console.log(`   Найдено активностей: ${activities.length}`)
  
  let created = 0
  let skipped = 0
  
  for (const act of activities) {
    try {
      await prisma.activity.create({
        data: {
          id: act.id,
          type: act.type,
          userId: act.userId || null,
          userRole: act.userRole,
          title: act.title,
          description: act.description,
          metadata: act.metadata ?? undefined,
          createdAt: act.createdAt ? new Date(act.createdAt) : new Date(),
        },
      })
      created++
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`   ⚠️  Активность ${act.id} уже существует, пропускаем`)
        skipped++
      } else {
        console.error(`   ❌ Ошибка добавления активности ${act.id}:`, error.message)
      }
    }
  }
  
  console.log(`   ✅ Создано: ${created}, пропущено: ${skipped}`)
}

async function main() {
  console.log('🚀 Начало миграции данных из JSON в Supabase...\n')
  
  try {
    await migrateUsers()
    await migrateReleases()
    await migrateReports()
    await migrateActivities()
    
    console.log('\n✅ Миграция завершена успешно!')
  } catch (error) {
    console.error('\n❌ Ошибка миграции:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
