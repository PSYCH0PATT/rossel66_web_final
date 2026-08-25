#!/usr/bin/env tsx
/**
 * Скрипт для ручной привязки релизов, отчётов и плейлистов к артисту
 * Использование: tsx scripts/assign-artist-data.ts <username>
 */

import { 
  getUserByUsername, 
  assignReportsToNewArtist, 
  assignReleasesToNewArtist,
  addActivity,
  getReleasesByArtistId
} from '../lib/storage'

async function assignArtistData(username: string) {
  console.log(`🔍 Поиск артиста: ${username}`)
  
  const artist = await getUserByUsername(username)
  
  if (!artist) {
    console.error(`❌ Артист с username "${username}" не найден`)
    process.exit(1)
  }
  
  if (artist.role !== 'artist') {
    console.error(`❌ Пользователь "${username}" не является артистом (роль: ${artist.role})`)
    process.exit(1)
  }
  
  console.log(`✅ Найден артист: ${artist.name} (ID: ${artist.id})`)
  console.log(`\n🔄 Начинаю привязку данных...`)
  
  // Привязываем отчёты
  console.log(`\n📊 Привязка отчётов...`)
  const assignedReports = await assignReportsToNewArtist(artist.id, artist.name)
  console.log(`✅ Привязано отчётов: ${assignedReports}`)
  
  // Привязываем релизы
  console.log(`\n🎵 Привязка релизов...`)
  const assignedReleases = await assignReleasesToNewArtist(artist.id, artist.name, username)
  console.log(`✅ Привязано релизов: ${assignedReleases}`)
  
  // Привязываем плейлисты
  console.log(`\n🎧 Привязка плейлистов...`)
  let assignedPlaylists = 0
  try {
    const { assignPlaylistsToArtist } = await import('../lib/sftp-playlist-storage')
    assignedPlaylists = await assignPlaylistsToArtist(artist.id, artist.name, username)
    console.log(`✅ Привязано плейлистов: ${assignedPlaylists}`)
  } catch (error) {
    console.error(`⚠️ Ошибка при привязке плейлистов:`, error)
  }
  
  // Логируем активность
  if (assignedReports > 0) {
    await addActivity({
      type: 'report_received',
      userId: artist.id,
      userRole: 'artist',
      title: 'Отчёты привязаны к артисту',
      description: `Вручную привязано ${assignedReports} отчёт(ов) к артисту "${artist.name}"`,
      metadata: { artistId: artist.id, count: assignedReports, manual: true }
    })
  }
  
  if (assignedReleases > 0) {
    const artistReleases = await getReleasesByArtistId(artist.id)
    for (const release of artistReleases) {
      // F-03: одна запись на событие вместо пары «артисту + админу».
      await addActivity({
        type: 'release_added',
        userId: artist.id,
        userRole: 'artist',
        title: 'Добавлен релиз',
        description: `Добавлен релиз "${release.title}"`,
        metadata: {
          artistId: artist.id,
          artistName: artist.name,
          releaseId: release.id,
          releaseTitle: release.title,
          manual: true,
        }
      })
    }
  }
  
  if (assignedPlaylists > 0) {
    await addActivity({
      type: 'playlist_found',
      userId: artist.id,
      userRole: 'artist',
      title: 'Плейлисты привязаны к артисту',
      description: `Вручную привязано ${assignedPlaylists} плейлист(ов) к артисту "${artist.name}"`,
      metadata: { artistId: artist.id, count: assignedPlaylists, manual: true }
    })
  }
  
  console.log(`\n✅ Готово!`)
  console.log(`📊 Итого:`)
  console.log(`   - Отчётов: ${assignedReports}`)
  console.log(`   - Релизов: ${assignedReleases}`)
  console.log(`   - Плейлистов: ${assignedPlaylists}`)
}

const username = process.argv[2]

if (!username) {
  console.error('❌ Использование: tsx scripts/assign-artist-data.ts <username>')
  process.exit(1)
}

assignArtistData(username).catch(error => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})
