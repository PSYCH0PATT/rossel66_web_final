/**
 * Анализ: сравнение последнего CSV аналитики (rossel_flash) с таблицей StreamAnalytics в Supabase.
 * Только чтение, ничего не меняет.
 *
 * Запуск: npx tsx scripts/analyze-flash-vs-supabase.ts [путь к CSV]
 * По умолчанию: последний rossel_flash_*.csv в sftp_downloads/
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { parseFlashCSV } from '../lib/flash-parser'
import { prisma } from '../lib/prisma'

function getLatestFlashCsv(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('rossel_flash_') && f.endsWith('.csv'))
    .sort()
  return files.length ? path.join(dir, files[files.length - 1]) : null
}

function key(r: { date: Date; isrc: string; dsp: string; length: string; source: string }) {
  const d = r.date instanceof Date ? r.date : new Date(r.date)
  return `${d.toISOString().split('T')[0]}|${r.isrc}|${r.dsp}|${r.length}|${r.source}`
}

async function main() {
  const csvPath = process.argv[2] || getLatestFlashCsv(path.join(process.cwd(), 'sftp_downloads'))
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('CSV не найден. Укажите путь или положите rossel_flash_*.csv в sftp_downloads/')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('Нет DATABASE_URL')
    process.exit(1)
  }

  const fileName = path.basename(csvPath)
  console.log('=== Анализ CSV ===')
  console.log('Файл:', fileName)

  const records = parseFlashCSV(csvPath)
  const dateStr = records.length ? records[0].date.toISOString().split('T')[0] : null
  if (!dateStr) {
    console.log('В CSV нет записей (или парсер пропустил все строки).')
    process.exit(0)
  }

  const csvByKey = new Map<string, { streams: number }>()
  let csvTotalStreams = 0
  for (const r of records) {
    const k = key(r)
    const prev = csvByKey.get(k)
    if (prev) prev.streams += r.streams
    else csvByKey.set(k, { streams: r.streams })
    csvTotalStreams += r.streams
  }

  console.log('Дата в CSV:', dateStr)
  console.log('Строк в CSV (с streams>0):', records.length)
  console.log('Уникальных ключей (date|isrc|dsp|length|source):', csvByKey.size)
  console.log('Сумма streams (CSV):', csvTotalStreams)
  console.log('')

  // DSP разбивка по CSV
  const dspStreams = new Map<string, number>()
  for (const r of records) {
    dspStreams.set(r.dsp, (dspStreams.get(r.dsp) || 0) + r.streams)
  }
  console.log('По DSP (CSV):', Object.fromEntries([...dspStreams.entries()].sort((a, b) => b[1] - a[1])))
  console.log('')

  console.log('=== Данные в Supabase (StreamAnalytics, isMonthlyAggregate=false) ===')
  const dbDate = new Date(dateStr)
  const dbRecords = await prisma.streamAnalytics.findMany({
    where: {
      date: { gte: new Date(dbDate.getFullYear(), dbDate.getMonth(), dbDate.getDate()), lt: new Date(dbDate.getFullYear(), dbDate.getMonth(), dbDate.getDate() + 1) },
      isMonthlyAggregate: false,
    },
    select: { date: true, isrc: true, dsp: true, length: true, source: true, streams: true },
  })

  const dbByKey = new Map<string, number>()
  let dbTotalStreams = 0
  for (const r of dbRecords) {
    const k = key(r)
    dbByKey.set(k, (dbByKey.get(k) || 0) + r.streams)
    dbTotalStreams += r.streams
  }

  console.log('Записей в БД за', dateStr + ':', dbRecords.length)
  console.log('Уникальных ключей в БД:', dbByKey.size)
  console.log('Сумма streams (БД):', dbTotalStreams)
  console.log('')

  const dbDspStreams = new Map<string, number>()
  for (const r of dbRecords) {
    dbDspStreams.set(r.dsp, (dbDspStreams.get(r.dsp) || 0) + r.streams)
  }
  console.log('По DSP (БД):', Object.fromEntries([...dbDspStreams.entries()].sort((a, b) => b[1] - a[1])))
  console.log('')

  console.log('=== Сравнение CSV vs Supabase ===')
  const onlyCsv: string[] = []
  const onlyDb: string[] = []
  const diffStreams: Array<{ key: string; csv: number; db: number }> = []

  for (const [k, v] of csvByKey) {
    const dbVal = dbByKey.get(k)
    if (dbVal === undefined) onlyCsv.push(k)
    else if (v.streams !== dbVal) diffStreams.push({ key: k, csv: v.streams, db: dbVal })
  }
  for (const k of dbByKey.keys()) {
    if (!csvByKey.has(k)) onlyDb.push(k)
  }

  console.log('Только в CSV (нет в БД):', onlyCsv.length, onlyCsv.length ? onlyCsv.slice(0, 5).join(' | ') + (onlyCsv.length > 5 ? ' ...' : '') : '')
  console.log('Только в БД (нет в CSV):', onlyDb.length, onlyDb.length ? onlyDb.slice(0, 5).join(' | ') + (onlyDb.length > 5 ? ' ...' : '') : '')
  console.log('Один ключ есть в обоих, но разное кол-во streams:', diffStreams.length)
  if (diffStreams.length > 0) {
    diffStreams.slice(0, 5).forEach(({ key: k, csv, db }) => console.log(`  ${k}  csv=${csv} db=${db}`))
    if (diffStreams.length > 5) console.log('  ...')
  }

  console.log('')
  console.log('Итог:')
  console.log('  Записей: CSV', records.length, '— БД', dbRecords.length, '  разница', records.length - dbRecords.length)
  console.log('  Сумма streams: CSV', csvTotalStreams, '— БД', dbTotalStreams, '  разница', csvTotalStreams - dbTotalStreams)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())