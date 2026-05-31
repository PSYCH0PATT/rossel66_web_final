/**
 * Точка восстановления: выгружает все данные из Supabase в один JSON-файл.
 * Не требует pg_dump — только Node и Prisma.
 *
 * Запуск: npx tsx scripts/backup-db-json.ts
 * Файл: backups/db/backup_YYYYMMDD_HHMMSS.json
 */

import { prisma } from '../lib/prisma'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Нет DATABASE_URL. Добавьте в .env или .env.local')
    process.exit(1)
  }

  const dir = join(process.cwd(), 'backups', 'db')
  mkdirSync(dir, { recursive: true })
  const name = `backup_${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_')}.json`
  const file = join(dir, name)

  console.log('Выгрузка User...')
  const users = await prisma.user.findMany()
  console.log('Выгрузка Release...')
  const releases = await prisma.release.findMany()
  console.log('Выгрузка Report...')
  const reports = await prisma.report.findMany()
  console.log('Выгрузка Activity...')
  const activities = await prisma.activity.findMany()
  console.log('Выгрузка Playlist...')
  const playlists = await prisma.playlist.findMany()
  console.log('Выгрузка StreamAnalytics...')
  const streamAnalytics = await prisma.streamAnalytics.findMany()

  const snapshot = {
    _meta: { exportedAt: new Date().toISOString(), schema: 'rossel-music' },
    User: users,
    Release: releases,
    Report: reports,
    Activity: activities,
    Playlist: playlists,
    StreamAnalytics: streamAnalytics,
  }

  writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf-8')
  console.log('Готово:', file)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())