import * as path from 'path'
import 'dotenv/config'
import { prisma } from '../lib/prisma'

const sqlite3 = require('sqlite3').verbose()
const DB_PATH = path.join(process.cwd(), 'sftp_playlists.db')

interface SQLitePlaylist {
  id: number
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
}

async function migratePlaylists() {
  console.log('🎵 Начинаем миграцию плейлистов из SQLite в Supabase...\n')
  
  const db = new sqlite3.Database(DB_PATH, (err: any) => {
    if (err) {
      console.error('❌ Ошибка открытия SQLite БД:', err)
      process.exit(1)
    }
  })
  
  return new Promise<void>((resolve, reject) => {
    db.all('SELECT * FROM sftp_playlists', async (err: any, rows: SQLitePlaylist[]) => {
      if (err) {
        console.error('❌ Ошибка чтения данных из SQLite:', err)
        reject(err)
        return
      }
      
      console.log(`📊 Найдено ${rows.length} плейлистов в SQLite\n`)
      
      let migrated = 0
      let skipped = 0
      let errors = 0
      
      for (const row of rows) {
        try {
          // Парсим track_data
          let trackData = []
          try {
            trackData = JSON.parse(row.track_data || '[]')
          } catch (e) {
            console.warn(`⚠️ Не удалось распарсить track_data для плейлиста ${row.playlist_name}`)
          }
          
          // Проверяем, существует ли уже такой плейлист
          const existing = await prisma.playlist.findFirst({
            where: {
              playlistUrl: row.playlist_url,
              playlistName: row.playlist_name,
              artistName: row.artist_name
            }
          })
          
          if (existing) {
            skipped++
            continue
          }
          
          // Создаем новый плейлист
          await prisma.playlist.create({
            data: {
              id: `playlist_${row.id}_${Date.now()}`,
              playlistUrl: row.playlist_url,
              playlistName: row.playlist_name,
              platform: row.platform,
              artistName: row.artist_name,
              artistId: row.artist_id,
              trackData: trackData as any,
              firstSeenDate: row.first_seen_date,
              lastSeenDate: row.last_seen_date,
              createdAt: row.created_at ? new Date(row.created_at) : new Date(),
              updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
            }
          })
          
          migrated++
          
          if (migrated % 10 === 0) {
            console.log(`✅ Перенесено ${migrated} плейлистов...`)
          }
          
        } catch (error: any) {
          errors++
          console.error(`❌ Ошибка переноса плейлиста ${row.playlist_name}:`, error.message)
        }
      }
      
      db.close()
      
      console.log('\n' + '='.repeat(60))
      console.log('📊 Результаты миграции:')
      console.log(`   ✅ Успешно перенесено: ${migrated}`)
      console.log(`   ⏭️  Пропущено (дубликаты): ${skipped}`)
      console.log(`   ❌ Ошибок: ${errors}`)
      console.log('='.repeat(60) + '\n')
      
      await prisma.$disconnect()
      resolve()
    })
  })
}

// Запуск миграции
migratePlaylists()
  .then(() => {
    console.log('✅ Миграция плейлистов завершена!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка миграции:', error)
    process.exit(1)
  })
