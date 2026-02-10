import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function main() {
  console.log('📊 Проверка данных в Supabase...\n')
  
  const users = await prisma.user.count()
  const releases = await prisma.release.count()
  const reports = await prisma.report.count()
  const activities = await prisma.activity.count()
  
  console.log('  Пользователей:', users)
  console.log('  Релизов:', releases)
  console.log('  Отчётов:', reports)
  console.log('  Активностей:', activities)
  
  console.log('\n✅ Подключение к Supabase работает!')
  console.log('\nПримеры данных:')
  
  const sampleUser = await prisma.user.findFirst({ where: { role: 'artist' } })
  if (sampleUser) {
    console.log(`  Артист: ${sampleUser.name} (@${sampleUser.username})`)
  }
  
  const sampleRelease = await prisma.release.findFirst()
  if (sampleRelease) {
    const trackCount = Array.isArray(sampleRelease.tracks) ? sampleRelease.tracks.length : 0
    console.log(`  Релиз: "${sampleRelease.title}" (треков: ${trackCount})`)
  }
  
  await prisma.$disconnect()
}

main()
