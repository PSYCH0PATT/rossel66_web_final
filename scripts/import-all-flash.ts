/**
 * Единоразовый скрипт: скачивает ВСЕ CSV из rossel_flash на SFTP
 * и импортирует их в Supabase (таблица StreamAnalytics).
 *
 * Запуск: npx tsx scripts/import-all-flash.ts
 */

import SftpClient from 'ssh2-sftp-client'
import * as fs from 'fs'
import * as path from 'path'
import {
  resolveFlashRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from '../lib/sftp-connect'

// ─── Env ────────────────────────────────────────────────────
function loadEnvLocal() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), envFile)
    if (!fs.existsSync(envPath)) continue
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = value
        }
      }
    }
  }
}

// ─── CSV Parser (standalone copy) ────────────────────────────

interface FlashRecord {
  date: Date
  dsp: string
  length: string
  source: string
  isrc: string
  trackArtist: string
  trackName: string
  albumTitle: string
  cpline: string
  albumReleaseDate: string
  daysSinceRelease: number
  streams: number
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ';') { fields.push(current.trim()); current = '' }
      else current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseFlashCSV(filePath: string): FlashRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const records: FlashRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    try {
      const f = parseCsvLine(lines[i])
      if (f.length < 12) continue
      const parts = f[0].split('-')
      if (parts.length !== 3) continue
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      if (isNaN(date.getTime())) continue
      const streams = parseInt(f[11])
      if (isNaN(streams) || streams <= 0) continue
      records.push({
        date, dsp: f[1] || 'Unknown', length: f[2] || 'Unknown', source: f[3] || 'Unknown',
        isrc: f[4] || '', trackArtist: f[5] || 'Unknown', trackName: f[6] || 'Unknown',
        albumTitle: f[7] || '', cpline: f[8] || '', albumReleaseDate: f[9] || '',
        daysSinceRelease: parseInt(f[10]) || 0, streams,
      })
    } catch { continue }
  }
  return records
}

// ─── DB (direct PG) ──────────────────────────────────────────

import { Pool } from 'pg'

async function saveRecordsToDB(pool: Pool, records: FlashRecord[], artistMap: Map<string, string>): Promise<{ added: number; skipped: number }> {
  if (records.length === 0) return { added: 0, skipped: 0 }

  // Check existing dates
  const dates = [...new Set(records.map(r => r.date.toISOString().split('T')[0]))]
  const existRes = await pool.query(
    `SELECT date, isrc, dsp, length, source FROM "StreamAnalytics" WHERE date = ANY($1) AND "isMonthlyAggregate" = false`,
    [dates.map(d => new Date(d))]
  )

  const existingKeys = new Set(
    existRes.rows.map((r: any) =>
      `${new Date(r.date).toISOString().split('T')[0]}|${r.isrc}|${r.dsp}|${r.length}|${r.source}`
    )
  )

  const toInsert: any[] = []
  let skipped = 0
  for (const rec of records) {
    const key = `${rec.date.toISOString().split('T')[0]}|${rec.isrc}|${rec.dsp}|${rec.length}|${rec.source}`
    if (existingKeys.has(key)) { skipped++; continue }
    const artistId = artistMap.get(rec.trackArtist.toLowerCase()) || null
    toInsert.push(rec)
    // Also track in existingKeys to avoid intra-batch duplicates
    existingKeys.add(key)
  }

  // Batch insert
  const BATCH = 200
  let added = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const values: any[] = []
    const placeholders: string[] = []
    let idx = 1
    for (const rec of batch) {
      const artistId = artistMap.get(rec.trackArtist.toLowerCase()) || null
      placeholders.push(`(gen_random_uuid(), $${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8}, $${idx+9}, $${idx+10}, $${idx+11}, $${idx+12}, false, NOW(), NOW())`)
      values.push(rec.date, rec.dsp, rec.length, rec.source, rec.isrc, rec.trackArtist, rec.trackName, rec.albumTitle, rec.cpline || null, rec.albumReleaseDate || null, rec.daysSinceRelease || null, rec.streams, artistId)
      idx += 13
    }
    await pool.query(
      `INSERT INTO "StreamAnalytics" (id, date, dsp, length, source, isrc, "trackArtist", "trackName", "albumTitle", cpline, "albumReleaseDate", "daysSinceRelease", streams, "artistId", "isMonthlyAggregate", "createdAt", "updatedAt") VALUES ${placeholders.join(',')}`,
      values
    )
    added += batch.length
  }

  return { added, skipped }
}

// ─── Main ────────────────────────────────────────────────────

const LOCAL_DIR = path.join(process.cwd(), 'sftp_downloads')

async function main() {
  loadEnvLocal()

  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) { console.error('❌ DATABASE_URL не установлен'); process.exit(1) }

  const sftpUser = process.env.SFTP_USERNAME
  const sftpPass = process.env.SFTP_PASSWORD
  if (!sftpUser || !sftpPass) { console.error('❌ SFTP_USERNAME / SFTP_PASSWORD не установлены'); process.exit(1) }

  // Connect to DB
  const pool = new Pool({ connectionString: dbUrl })
  console.log('🔌 Подключение к базе данных...')
  await pool.query('SELECT 1')
  console.log('✅ БД подключена')

  // Load artist mapping
  const usersRes = await pool.query(`SELECT id, name, username FROM "User" WHERE role = 'artist'`)
  const artistMap = new Map<string, string>()
  for (const u of usersRes.rows) {
    if (u.name) artistMap.set(u.name.toLowerCase(), u.id)
    if (u.username) artistMap.set(u.username.toLowerCase(), u.id)
  }
  console.log(`👥 Загружено ${usersRes.rows.length} артистов для маппинга`)

  // Connect to SFTP
  const sftp = new SftpClient()
  const sftpConfig = {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username: sftpUser,
    password: sftpPass,
  }

  console.log(`🔌 Подключение к SFTP ${sftpConfig.host}:${sftpConfig.port}...`)
  const connectOpts = await withIpv4SocketIfRequested(sftpConnectOptions(sftpConfig))
  await sftp.connect(connectOpts as any)
  console.log('✅ SFTP подключен')

  const flashDir = await resolveFlashRemoteDir(sftp)
  if (!flashDir) {
    console.error('❌ Не найден каталог rossel_flash')
    await sftp.end().catch(() => {})
    await pool.end()
    process.exit(1)
  }
  console.log(`📁 Каталог аналитики: ${flashDir}`)

  // List files
  const files = await sftp.list(flashDir)
  const csvFiles = (files as any[])
    .filter((f: any) => f.type === '-' && f.name.endsWith('.csv'))
    .map((f: any) => {
      const m = f.name.match(/rossel_flash_(\d{4})_(\d{2})_(\d{2})\.csv$/)
      return { name: f.name, date: m ? `${m[1]}-${m[2]}-${m[3]}` : null }
    })
    .filter(f => f.date)
    .sort((a, b) => a.date!.localeCompare(b.date!))

  console.log(`📋 Найдено ${csvFiles.length} CSV файлов в ${flashDir}`)

  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true })

  let totalAdded = 0
  let totalSkipped = 0

  for (const file of csvFiles) {
    const localPath = path.join(LOCAL_DIR, file.name)

    // Скачиваем если нет
    if (!fs.existsSync(localPath)) {
      process.stdout.write(`⬇️  ${file.name}...`)
      await sftp.fastGet(path.posix.join(flashDir, file.name), localPath)
      console.log(' скачано')
    } else {
      console.log(`📁 ${file.name} — уже скачан`)
    }

    // Parse and import
    const records = parseFlashCSV(localPath)
    const result = await saveRecordsToDB(pool, records, artistMap)
    totalAdded += result.added
    totalSkipped += result.skipped
    console.log(`   📊 ${records.length} записей → добавлено ${result.added}, пропущено ${result.skipped}`)
  }

  await sftp.end()
  await pool.end()

  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log(`✅ Полный импорт завершён`)
  console.log(`   Файлов: ${csvFiles.length}`)
  console.log(`   Добавлено: ${totalAdded}`)
  console.log(`   Пропущено: ${totalSkipped}`)
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => { console.error('❌ Фатальная ошибка:', err); process.exit(1) })
