/**
 * Парсер CSV файлов из rossel_flash (SFTP).
 * CSV использует точку с запятой (;) как разделитель.
 * Поля в кавычках могут содержать ; внутри.
 *
 * Колонки:
 * date;DSP;length;source;isrc;track_artist;track_name;album_title;cpline;album_release_date;days_since_release;streams
 */

import * as fs from 'fs'

export interface FlashRecord {
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

/**
 * Разбирает строку CSV с учётом кавычек.
 * Разделитель — точка с запятой (;).
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        // Проверяем escaped кавычку ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // пропускаем следующую кавычку
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ';') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }

  fields.push(current.trim())
  return fields
}

/**
 * Парсит CSV файл из rossel_flash и возвращает массив записей.
 */
export function parseFlashCSV(filePath: string): FlashRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim().length > 0)

  if (lines.length < 2) {
    return []
  }

  // Пропускаем заголовок
  const records: FlashRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCsvLine(lines[i])
      if (fields.length < 12) continue

      const dateStr = fields[0] // формат: 2026-02-11
      const dateParts = dateStr.split('-')
      if (dateParts.length !== 3) continue

      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2])
      )

      if (isNaN(date.getTime())) continue

      const streams = parseInt(fields[11])
      if (isNaN(streams) || streams <= 0) continue

      records.push({
        date,
        dsp: fields[1] || 'Unknown',
        length: fields[2] || 'Unknown',
        source: fields[3] || 'Unknown',
        isrc: fields[4] || '',
        trackArtist: fields[5] || 'Unknown',
        trackName: fields[6] || 'Unknown',
        albumTitle: fields[7] || '',
        cpline: fields[8] || '',
        albumReleaseDate: fields[9] || '',
        daysSinceRelease: parseInt(fields[10]) || 0,
        streams,
      })
    } catch (err) {
      console.warn(`⚠️ Ошибка парсинга строки ${i + 1}:`, err)
      continue
    }
  }

  return records
}

/**
 * Парсит CSV из Buffer (для загрузки через API).
 */
export function parseFlashCSVFromBuffer(buffer: Buffer): FlashRecord[] {
  const tmpPath = `/tmp/flash_upload_${Date.now()}.csv`
  fs.writeFileSync(tmpPath, new Uint8Array(buffer))
  try {
    return parseFlashCSV(tmpPath)
  } finally {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}
