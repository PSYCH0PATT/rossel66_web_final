/**
 * Пересопоставление StreamAnalytics строк с artistId IS NULL.
 * Запуск: npx tsx scripts/rematch-analytics-artists.ts
 */

import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { rematchUnmappedAnalytics } from '../lib/analytics-artist-match'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL не установлен')
    process.exit(1)
  }

  console.log('🔄 Пересопоставление аналитики...')
  const result = await rematchUnmappedAnalytics()

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log(`✅ Обработано trackArtist: ${result.trackArtistsProcessed}`)
  console.log(`   Обновлено строк: ${result.rowsUpdated}`)
  console.log(`   Осталось без профиля: ${result.stillUnmapped}`)
  console.log('═══════════════════════════════════════════════════')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
