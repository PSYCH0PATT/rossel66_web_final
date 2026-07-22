/**
 * Хранение и агрегация данных stream-аналитики из rossel_flash.
 * Все данные хранятся в таблице StreamAnalytics (Prisma/Supabase).
 */

import { prisma } from '@/lib/prisma'
import {
  loadAnalyticsArtistLookup,
  resolveArtistId,
  buildCabinetStreamAnalyticsWhere,
} from '@/lib/analytics-artist-match'
import type { FlashRecord } from './flash-parser'
import { isPaidStreamLength } from '@/lib/stream-length'

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
    const lookup = await loadAnalyticsArtistLookup()

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

      const artistId = resolveArtistId(rec.trackArtist, lookup)

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
      existingKeys.add(key)
    }

    // Batch insert (разбиваем на куски по 500)
    const BATCH_SIZE = 500
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)
      const r = await prisma.streamAnalytics.createMany({
        data: batch,
        skipDuplicates: true,
      })
      result.added += r.count
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
  trackArtist?: string
  startDate?: string  // ISO date string
  endDate?: string    // ISO date string
  trackName?: string
  isrc?: string
  /** Prisma where override for artist cabinet (OR: artistId + unmapped collabs). */
  cabinetWhere?: Record<string, unknown>
}

/**
 * Возвращает данные для всех 4 графиков:
 * 1. Стримы по платформам (DSP) по дням — для XY графика с линиями
 * 2. Общие стримы по дням — для XY графика
 * 3. Платные vs бесплатные — для горизонтального бара (всегда за всё время)
 * 4. Стримы по источникам — для горизонтального бара (всегда за всё время)
 */
const DEFAULT_ANALYTICS_RANGE_DAYS = 90

function buildStreamAnalyticsWhere(filters: StreamFilters): { rangeWhere: Record<string, unknown> } {
  const baseWhere: Record<string, unknown> = {}
  if (filters.cabinetWhere) {
    Object.assign(baseWhere, filters.cabinetWhere)
  } else if (filters.artistId) {
    baseWhere.artistId = filters.artistId
  } else if (filters.trackArtist) {
    baseWhere.trackArtist = filters.trackArtist
  }
  if (filters.trackName) baseWhere.trackName = filters.trackName
  if (filters.isrc) baseWhere.isrc = filters.isrc

  const rangeWhere: Record<string, unknown> = { ...baseWhere }
  if (!filters.startDate && !filters.endDate) {
    const end = new Date()
    const start = new Date(end.getTime() - DEFAULT_ANALYTICS_RANGE_DAYS * 24 * 60 * 60 * 1000)
    rangeWhere.date = { gte: start, lte: end }
  } else {
    const date: Record<string, Date> = {}
    if (filters.startDate) date.gte = new Date(filters.startDate)
    if (filters.endDate) date.lte = new Date(filters.endDate)
    rangeWhere.date = date
  }

  return { rangeWhere }
}

export async function getStreamAnalytics(filters: StreamFilters) {
  const { rangeWhere } = buildStreamAnalyticsWhere(filters)

  // Отображаемые названия площадок (артистам показываем понятные имена)
  const dspDisplayName = (dsp: string) => (dsp === 'UMA' ? 'ВК Музыка' : dsp)

  // 1+2. Стримы по дням и платформам + общие стримы по дням — через groupBy
  const rawByDspDay = await prisma.streamAnalytics.groupBy({
    by: ['date', 'dsp'],
    where: rangeWhere,
    _sum: { streams: true },
    orderBy: { date: 'asc' },
  })

  const dspDayMap = new Map<string, Map<string, number>>()
  const allDsps = new Set<string>()
  const totalDayMap = new Map<string, number>()

  for (const r of rawByDspDay) {
    const day = r.date.toISOString().split('T')[0]
    const dspName = dspDisplayName(r.dsp)
    const count = r._sum.streams ?? 0

    if (!dspDayMap.has(day)) dspDayMap.set(day, new Map())
    const dayMap = dspDayMap.get(day)!
    dayMap.set(dspName, (dayMap.get(dspName) || 0) + count)
    allDsps.add(dspName)

    totalDayMap.set(day, (totalDayMap.get(day) || 0) + count)
  }

  const streamsByDspDay: Array<{ date: string; [dsp: string]: string | number }> = []
  for (const [day, dspMap] of [...dspDayMap.entries()].sort()) {
    const entry: any = { date: day }
    for (const [dsp, count] of dspMap) {
      entry[dsp] = count
    }
    streamsByDspDay.push(entry)
  }

  const streamsByDay = [...totalDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, streams]) => ({ date, streams }))

  // 3. Платные vs бесплатные + источники — через groupBy
  const [lengthAgg, sourceAgg] = await Promise.all([
    prisma.streamAnalytics.groupBy({
      by: ['length'],
      where: rangeWhere,
      _sum: { streams: true },
    }),
    prisma.streamAnalytics.groupBy({
      by: ['source'],
      where: rangeWhere,
      _sum: { streams: true },
      orderBy: { _sum: { streams: 'desc' } },
    }),
  ])

  let paidStreams = 0
  let freeStreams = 0
  for (const r of lengthAgg) {
    const isPaid = isPaidStreamLength(r.length)
    const count = r._sum.streams ?? 0
    if (isPaid) paidStreams += count
    else freeStreams += count
  }

  const paidVsFree = [
    { name: 'Платные', value: paidStreams },
    { name: 'Бесплатные', value: freeStreams },
  ]

  const streamsBySource = sourceAgg.map(r => ({
    name: r.source,
    value: r._sum.streams ?? 0,
  }))

  // 5. По трекам (все треки с общим числом прослушиваний + paid/free) — для горизонтальных списков
  const trackAgg = await prisma.streamAnalytics.groupBy({
    by: ['trackName', 'trackArtist', 'isrc', 'length'],
    where: rangeWhere,
    _sum: { streams: true },
  })

  const trackMap = new Map<string, { trackName: string; trackArtist: string; isrc: string; value: number; paid: number; free: number }>()

  for (const r of trackAgg) {
    const key = r.isrc || r.trackName // Fallback to trackName if isrc missing
    if (!trackMap.has(key)) {
      trackMap.set(key, {
        trackName: r.trackName,
        trackArtist: r.trackArtist,
        isrc: r.isrc,
        value: 0,
        paid: 0,
        free: 0
      })
    }
    
    const track = trackMap.get(key)!
    const count = r._sum.streams ?? 0
    track.value += count

    const isPaid = isPaidStreamLength(r.length)
    if (isPaid) track.paid += count
    else track.free += count
  }

  const streamsByTrack = [...trackMap.values()].sort((a, b) => b.value - a.value)

  const totalStreams = streamsByDay.reduce((s, d) => s + d.streams, 0)

  return {
    streamsByDspDay,
    dsps: [...allDsps],
    streamsByDay,
    paidVsFree,
    streamsBySource,
    streamsByTrack,
    totalStreams,
  }
}

/**
 * Возвращает список уникальных треков для фильтра-выпадашки.
 */
export async function getAvailableTracks(
  filters?: Pick<StreamFilters, 'artistId' | 'trackArtist' | 'cabinetWhere'>,
  opts?: { take?: number; skip?: number }
) {
  const where: Record<string, unknown> = {}
  if (filters?.cabinetWhere) {
    Object.assign(where, filters.cabinetWhere)
  } else if (filters?.artistId) {
    where.artistId = filters.artistId
  } else if (filters?.trackArtist) {
    where.trackArtist = filters.trackArtist
  }
  const take = Math.min(opts?.take ?? 500, 2000)
  const skip = Math.max(0, opts?.skip ?? 0)

  const tracks = await prisma.streamAnalytics.findMany({
    where,
    select: { trackName: true, trackArtist: true, isrc: true },
    distinct: ['isrc'],
    orderBy: { trackName: 'asc' },
    take,
    skip,
  })

  return tracks.map(t => ({
    trackName: t.trackName,
    trackArtist: t.trackArtist,
    isrc: t.isrc,
  }))
}

export type AnalyticsArtistOption = {
  /** Стабильный ключ опции: artistId для смапленных, trackArtist для немапленных. */
  id: string
  /** Отображаемое имя: профиль для смапленных, сырое имя для немапленных. */
  label: string
  trackArtist: string
  artistId: string | null
  mappedProfileName: string | null
  mappedUsername: string | null
  totalStreams: number
}

/**
 * Список артистов для админского фильтра.
 * Смапленные trackArtist консолидируются по artistId (ростер) — «Artist» и
 * «Artist feat Guest», ведущие на один профиль, схлопываются в одну запись.
 * Немапленные имена остаются отдельными (их привязывают вручную).
 */
export async function getAvailableArtists(opts?: { take?: number; skip?: number }) {
  const take = Math.min(opts?.take ?? 500, 2000)
  const skip = Math.max(0, opts?.skip ?? 0)

  const grouped = await prisma.streamAnalytics.groupBy({
    by: ['trackArtist', 'artistId'],
    _sum: { streams: true },
    orderBy: { trackArtist: 'asc' },
  })

  // Консолидация смапленных по artistId; немапленные — по trackArtist
  const byArtistId = new Map<string, number>()
  const unmappedByTrackArtist = new Map<string, number>()
  for (const g of grouped) {
    const streams = g._sum.streams ?? 0
    if (g.artistId) {
      byArtistId.set(g.artistId, (byArtistId.get(g.artistId) ?? 0) + streams)
    } else {
      unmappedByTrackArtist.set(
        g.trackArtist,
        (unmappedByTrackArtist.get(g.trackArtist) ?? 0) + streams
      )
    }
  }

  const artistIds = [...byArtistId.keys()]
  const users =
    artistIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, name: true, username: true },
        })
      : []
  const userById = new Map(users.map((u) => [u.id, u]))

  const mappedOptions: AnalyticsArtistOption[] = artistIds.map((artistId) => {
    const profile = userById.get(artistId)
    const label = profile?.name || profile?.username || artistId
    return {
      id: artistId,
      label,
      trackArtist: label,
      artistId,
      mappedProfileName: profile?.name ?? null,
      mappedUsername: profile?.username ?? null,
      totalStreams: byArtistId.get(artistId) ?? 0,
    }
  })

  const unmappedOptions: AnalyticsArtistOption[] = [...unmappedByTrackArtist.entries()].map(
    ([trackArtist, totalStreams]) => ({
      id: trackArtist,
      label: trackArtist,
      trackArtist,
      artistId: null,
      mappedProfileName: null,
      mappedUsername: null,
      totalStreams,
    })
  )

  return [...mappedOptions, ...unmappedOptions]
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
    .slice(skip, skip + take)
}

export { buildCabinetStreamAnalyticsWhere }

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
      const r = await prisma.streamAnalytics.createMany({
        data: batch,
        skipDuplicates: true,
      })
      result.aggregated += r.count
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
