/**
 * Единоразовая очистка дубликатов релизов в Supabase:
 * по каждому koalaId оставляет один релиз (самый ранний по createdAt), остальные удаляет.
 *
 * Запуск: npx tsx scripts/cleanup-duplicate-releases.ts
 * Требуется DATABASE_URL в .env или .env.local
 */

import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Нет DATABASE_URL. Запустите из корня проекта с .env или .env.local')
    process.exit(1)
  }

  console.log('Загрузка релизов с koalaId...')
  const releases = await prisma.release.findMany({
    where: { koalaId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, koalaId: true, title: true, artistId: true, createdAt: true }
  })

  const byKoala = new Map<string, typeof releases>()
  for (const r of releases) {
    const kid = r.koalaId!
    if (!byKoala.has(kid)) byKoala.set(kid, [])
    byKoala.get(kid)!.push(r)
  }

  const duplicates = [...byKoala.entries()].filter(([, list]) => list.length > 1)
  if (duplicates.length === 0) {
    console.log('Дубликатов по koalaId не найдено.')
    return
  }

  console.log(`Найдено ${duplicates.length} koalaId с дубликатами.`)
  const toDelete: string[] = []
  for (const [koalaId, list] of duplicates) {
    const [keep, ...remove] = list
    console.log(`  koalaId=${koalaId} "${keep.title}": оставляем ${keep.id}, удаляем ${remove.length} шт.`)
    toDelete.push(...remove.map(r => r.id))
  }

  if (toDelete.length === 0) return
  console.log(`\nУдаление ${toDelete.length} дубликатов...`)
  const result = await prisma.release.deleteMany({ where: { id: { in: toDelete } } })
  console.log(`Удалено записей: ${result.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
