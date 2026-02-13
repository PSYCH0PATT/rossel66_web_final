/**
 * Хранение и агрегация данных stream-аналитики из rossel_flash.
 * Все данные хранятся в таблице StreamAnalytics (Prisma/Supabase).
 */

import { prisma } from '@/lib/prisma'
import type { FlashRecord } from './flash-parser'

// ─── Сохранение ────────────────────────────────────────────────

export interface SaveFlashResult {
  added: number
  skipped: number
  errors: string[]
}

/**
 * Сохраняет записи FlashRecord в базу данных.
 * Пропускает дубликаты по дате + isrc + dsp + length + source.
 * Автоматически маппит trackArtist → artistId из таблицы User.
 */
export async function saveFlashRecords(records: FlashRecord[]): Promise<SaveFlashResult> {
  const result: SaveFlashResult = { added: 0, skipped: 0, errors: [] }

  if (records.length === 0) return result

  try {
    // Загружаем всех артистов для маппинга
    const users = await prisma.user.findMany({
      where: { role: 'artist' },
      select: { id: true, name: true, username: true }
    })

    // Создаём Map для быстрого поиска по имени (lowercase)
    const artistMap = new Map<string, string>()
    for (const u of users) {
      if (u.name) artistMap.set(u.name.toLowerCase(), u.id)
      if (u.username) artistMap.set(u.username.toLowerCase(), u.id)
    }

    // Проверяем какие даты уже есть в БД для избежания дубликатов
    const dates = [...new Set(records.map(r => r.date.toISOString().split('T')[0]))]
    const existingRecords = await prisma.streamAnalytics.findMany({
      where: {
        date: {
          in: dates.map(d => new Date(d))
        },
        isMonthlyAggregate: false
      },
      select: { date: true, isrc: true, dsp: true, length: true, source: true }
    })

    // Создаём Set для проверки дубликатов
    const existingKeys = new Set(
      existingRecords.map(r =>
        `${r.date.toISOString().split('T')[0]}|${r.isrc}|${r.dsp}|${r.length}|${r.source}`
      )
    )

    // Подготавливаем записи для batch insert
    const toInsert = []
    for (const rec of records) {
      const key = `${rec.date.toISOString().split('T')[0]}|${rec.isrc}|${rec.dsp}|${rec.length}|${rec.source}`
      if (existingKeys.has(key)) {
        result.skipped++
        continue
      }

      const artistId = artistMap.get(rec.trackArtist.toLowerCase()) || null

      toInsert.push({
        date: rec.date,
        dsp: rec.dsp,
        length: rec.length,
        source: rec.source,
        isrc: rec.isrc,
        trackArtist: rec.trackArtist,
        trackName: rec.trackName,
        albumTitle: rec.albumTitle,
        cpline: rec.cpline || null,
        albumReleaseDate: rec.albumReleaseDate || null,
        daysSinceRelease: rec.daysSinceRelease || null,
        streams: rec.streams,
        artistId,
        isMonthlyAggregate: false,
        month: null,
        year: null,
      })
    }

    // Batch insert (разбиваем на куски по 500)
    const BATCH_SIZE = 500
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      await prisma.streamAnalytics.createMany({ data: batch })
      result.added += batch.length
    }

  } catch (error) {
    result.errors.push(String(error))
    console.error('❌ Ошибка сохранения flash records:', error)
  }

  return result
}

// ─── Получение данных для графиков ──────────────────────────────

export interface StreamFilters {
  artistId?: string
  startDate?: string  // ISO date string
  endDate?: string    // ISO date string
  trackName?: string
  isrc?: string
}

/**
 * Возвращает данные для всех 4 графиков:
 * 1. Стримы по платформам (DSP) по дням — для XY графика с линиями
 * 2. Общие стримы по дням — для XY графика
 * 3. Платные vs бесплатные — для горизонтального бара (всегда за всё время)
 * 4. Стримы по источникам — для горизонтального бара (всегда за всё время)
 */
export async function getStreamAnalytics(filters: StreamFilters) {
  // Базовый where для фильтрации
  const baseWhere: any = {}
  if (filters.artistId) baseWhere.artistId = filters.artistId
  if (filters.trackName) baseWhere.trackName = filters.trackName
  if (filters.isrc) baseWhere.isrc = filters.isrc

  // Where с датами (для XY графиков)
  const dateWhere: any = { ...baseWhere }
  if (filters.startDate || filters.endDate) {
    dateWhere.date = {}
    if (filters.startDate) dateWhere.date.gte = new Date(filters.startDate)
    if (filters.endDate) dateWhere.date.lte = new Date(filters.endDate)
  }

  // Отображаемые названия площадок (артистам показываем понятные имена)
  const dspDisplayName = (dsp: string) => (dsp === 'UMA' ? 'ВК Музыка' : dsp)

  // 1. Стримы по дням и платформам (XY)
  const rawByDspDay = await prisma.streamAnalytics.findMany({
    where: dateWhere,
    select: { date: true, dsp: true, streams: true }
  })

  // Агрегируем по дням и DSP
  const dspDayMap = new Map<string, Map<string, number>>()
  for (const r of rawByDspDay) {
    const day = r.date.toISOString().split('T')[0]
    const dspName = dspDisplayName(r.dsp)
    if (!dspDayMap.has(day)) dspDayMap.set(day, new Map())
    const dayMap = dspDayMap.get(day)!
    dayMap.set(dspName, (dayMap.get(dspName) || 0) + r.streams)
  }

  const streamsByDspDay: Array<{ date: string; [dsp: string]: string | number }> = []
  const allDsps = new Set<string>()
  for (const [day, dspMap] of [...dspDayMap.entries()].sort()) {
    const entry: any = { date: day }
    for (const [dsp, count] of dspMap) {
      entry[dsp] = count
      allDsps.add(dsp)
    }
    streamsByDspDay.push(entry)
  }

  // 2. Общие стримы по дням (XY)
  const totalDayMap = new Map<string, number>()
  for (const r of rawByDspDay) {
    const day = r.date.toISOString().split('T')[0]
    totalDayMap.set(day, (totalDayMap.get(day) || 0) + r.streams)
  }

  const streamsByDay = [...totalDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }))

  // 3. Платные vs бесплатные (за всё время)
  const allForBars = await prisma.streamAnalytics.findMany({
    where: baseWhere,
    select: { length: true, source: true, streams: true }
  })

  let paidStreams = 0
  let freeStreams = 0
  const sourceMap = new Map<string, number>()

  for (const r of allForBars) {
    const isPaid = r.length === 'Полный стрим' || r.length.toLowerCase() === 'full'
    if (isPaid) {
      paidStreams += r.streams
    } else {
      freeStreams += r.streams
    }
    sourceMap.set(r.source, (sourceMap.get(r.source) || 0) + r.streams)
  }

  const paidVsFree = [
    { name: 'Платные', value: paidStreams },
    { name: 'Бесплатные', value: freeStreams },
  ]

  const streamsBySource = [...sourceMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  return {
    streamsByDspDay,
    dsps: [...allDsps],
    streamsByDay,
    paidVsFree,
    streamsBySource,
  }
}

/**
 * Возвращает список уникальных треков для фильтра-выпадашки.
 */
export async function getAvailableTracks(artistId?: string) {
  const where: any = {}
  if (artistId) where.artistId = artistId

  const tracks = await prisma.streamAnalytics.findMany({
    where,
    select: { trackName: true, trackArtist: true, isrc: true },
    distinct: ['isrc'],
    orderBy: { trackName: 'asc' },
  })

  return tracks.map(t => ({
    trackName: t.trackName,
    trackArtist: t.trackArtist,
    isrc: t.isrc,
  }))
}

/**
 * Возвращает список уникальных артистов из аналитики (для админского фильтра).
 */
export async function getAvailableArtists() {
  const artists = await prisma.streamAnalytics.findMany({
    select: { trackArtist: true, artistId: true },
    distinct: ['artistId'],
    where: { artistId: { not: null } },
    orderBy: { trackArtist: 'asc' },
  })

  return artists.map(a => ({
    trackArtist: a.trackArtist,
    artistId: a.artistId!,
  }))
}

// ─── Годовая агрегация и очистка ────────────────────────────────

/**
 * Агрегация данных за прошлый год по месяцам + удаление дневных записей.
 * Запускается 1 января.
 * Для каждого трека (isrc) + артиста + месяц создаётся одна агрегированная запись.
 */
export async function aggregateAndCleanup(): Promise<{
  aggregated: number
  deleted: number
  errors: string[]
}> {
  const result = { aggregated: 0, deleted: 0, errors: [] as string[] }

  try {
    const lastYear = new Date().getFullYear() - 1
    const startOfLastYear = new Date(lastYear, 0, 1) // Jan 1
    const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59) // Dec 31

    // Получаем все дневные записи за прошлый год
    const dailyRecords = await prisma.streamAnalytics.findMany({
      where: {
        isMonthlyAggregate: false,
        date: {
          gte: startOfLastYear,
          lte: endOfLastYear,
        },
      },
    })

    if (dailyRecords.length === 0) {
      console.log('📭 Нет дневных записей за прошлый год для агрегации')
      return result
    }

    // Агрегируем по: месяц + isrc + artistId + dsp + length + source
    const aggregates = new Map<string, {
      month: number
      year: number
      isrc: string
      trackArtist: string
      trackName: string
      albumTitle: string
      artistId: string | null
      dsp: string
      length: string
      source: string
      cpline: string | null
      albumReleaseDate: string | null
      totalStreams: number
    }>()

    for (const rec of dailyRecords) {
      const month = rec.date.getMonth() + 1 // 1-12
      const key = `${month}|${rec.isrc}|${rec.artistId || 'null'}|${rec.dsp}|${rec.length}|${rec.source}`

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          month,
          year: lastYear,
          isrc: rec.isrc,
          trackArtist: rec.trackArtist,
          trackName: rec.trackName,
          albumTitle: rec.albumTitle,
          artistId: rec.artistId,
          dsp: rec.dsp,
          length: rec.length,
          source: rec.source,
          cpline: rec.cpline,
          albumReleaseDate: rec.albumReleaseDate,
          totalStreams: 0,
        })
      }

      aggregates.get(key)!.totalStreams += rec.streams
    }

    // Создаём агрегаты
    const toInsert = [...aggregates.values()].map(a => ({
      date: new Date(a.year, a.month - 1, 1), // первое число месяца
      dsp: a.dsp,
      length: a.length,
      source: a.source,
      isrc: a.isrc,
      trackArtist: a.trackArtist,
      trackName: a.trackName,
      albumTitle: a.albumTitle,
      cpline: a.cpline,
      albumReleaseDate: a.albumReleaseDate,
      daysSinceRelease: null,
      streams: a.totalStreams,
      artistId: a.artistId,
      isMonthlyAggregate: true,
      month: a.month,
      year: a.year,
    }))

    // Batch insert агрегатов
    const BATCH_SIZE = 500
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      await prisma.streamAnalytics.createMany({ data: batch })
      result.aggregated += batch.length
    }

    // Удаляем дневные записи за прошлый год
    const deleteResult = await prisma.streamAnalytics.deleteMany({
      where: {
        isMonthlyAggregate: false,
        date: {
          gte: startOfLastYear,
          lte: endOfLastYear,
        },
      },
    })

    result.deleted = deleteResult.count

    console.log(`✅ Агрегация завершена: ${result.aggregated} агрегатов, ${result.deleted} дневных записей удалено`)

  } catch (error) {
    result.errors.push(String(error))
    console.error('❌ Ошибка агрегации:', error)
  }

  return result
}
