/**
 * Сборка квартальных отчётов — TypeScript-замена питон-обработчика.
 *
 * Раньше это был отдельный процесс на python с pandas и openpyxl, который
 * запускался через spawn. На Vercel интерпретатора нет вовсе, поэтому стейджинг
 * не мог проверять отчёты — а это главная денежная функция. Теперь один и тот же
 * код работает в обоих контурах.
 *
 * Поведение сохранено дословно, включая неочевидные места: округления и их
 * порядок, ключ группировки треков, доли при коллаборациях. Расхождения с
 * питоном проверяются эталоном в tests/fixtures/golden-report.json.
 */
import { writeFile } from "fs/promises"
import path from "path"
import {
  buildArtistsIndex,
  extractArtistsFromTrack,
  type ArtistsIndex,
  type ExportedArtist,
  type IncompleteArtist,
} from "./artists"
import { pyRound } from "./rounding"
import {
  calculateArtistShare,
  loadRoyaltySharesFromTracks,
  normalizeShareKeys,
  parsePercentage,
} from "./shares"
import { loadStatement, type StatementRow } from "./statement"
import {
  buildArtistReport,
  formatQuarterLabels,
  sanitizeFileName,
  type TrackRow,
} from "./workbook"

export type ReportMetadata = {
  id: string
  artistId: string | null
  artistName: string
  quarter: string
  year: number
  fileName: string
  filePath: string
  uploadDate: string
  status: string
  totalPlays: number
  totalAmount: number
  isRegistered: boolean
  isSigned: boolean
  isPaid: boolean
  isAcknowledged: boolean
}

export type UnmatchedArtist = { trackArtist: string; rows: number; totalAmount: number }

export type ProcessReportsResult = {
  metadata: ReportMetadata[]
  createdFiles: string[]
  incompleteArtists: IncompleteArtist[]
  unmatchedArtists: UnmatchedArtist[]
  unmatchedTruncated: boolean
  logs: string[]
}

export type ProcessReportsOptions = {
  statementPath: string
  quarter: string
  year: number
  users: ExportedArtist[]
  releases: Array<{ tracks?: Array<{ isrc?: string | null; royaltyShares?: Record<string, number> | null }> | null }>
  reportsDir: string
  templatePath: string
  columnMapping?: Record<string, string> | null
  approvalDate?: Date
}

const UNMATCHED_LIMIT = 200

/** Ключ трека — четыре поля, а не один ISRC: так было в питоне. */
function trackKeyOf(row: StatementRow): string {
  return JSON.stringify([
    row["Код"] ?? null,
    row["Исполнитель"] ?? null,
    row["Наименование"] ?? null,
    row["Альбом"] ?? null,
  ])
}

/** Артисты из выписки — для фильтрации списка неполных. */
function collectStatementArtists(rows: StatementRow[], index: ArtistsIndex): Set<string> {
  const artists = new Set<string>()
  for (const row of rows) {
    for (const artist of extractArtistsFromTrack(row["Исполнитель"], index.matchList)) {
      artists.add(artist)
    }
  }
  return artists
}

export async function processReports(
  options: ProcessReportsOptions
): Promise<ProcessReportsResult> {
  const {
    statementPath, quarter, year, users, releases,
    reportsDir, templatePath, columnMapping, approvalDate = new Date(),
  } = options

  const { quarterLabel, periodLabel } = formatQuarterLabels(quarter, year)
  const index = buildArtistsIndex(users)
  const logs = [...index.logs]

  const { rows } = await loadStatement(statementPath, columnMapping)

  const statementArtists = collectStatementArtists(rows, index)
  const incompleteInStatement = index.skippedIncomplete.filter((item) =>
    statementArtists.has(item.name)
  )

  if (index.artistsData.size === 0) {
    logs.push("⚠️  Не найдено артистов с полными данными для отчёта")
    return {
      metadata: [], createdFiles: [],
      incompleteArtists: incompleteInStatement,
      unmatchedArtists: [], unmatchedTruncated: false, logs,
    }
  }

  const trackRoyaltyShares = normalizeShareKeys(
    loadRoyaltySharesFromTracks(releases),
    index.aliasToCanonical
  )
  // Файл долей в проде не передаётся — пустая карта, как get_royalty_shares().
  const royaltyShares = normalizeShareKeys(new Map(), index.aliasToCanonical)

  // Агрегация. Порядок вставки сохраняется — от него зависит порядок строк
  // в листе артиста и порядок отчётов.
  const artistsTracks = new Map<string, Map<string, TrackRow>>()
  const unmatched = new Map<string, { rows: number; totalAmount: number }>()

  for (const row of rows) {
    const trackArtists = extractArtistsFromTrack(row["Исполнитель"], index.matchList)
    if (trackArtists.length === 0) {
      const key = String(row["Исполнитель"] ?? "").trim() || "(пусто)"
      const bucket = unmatched.get(key) ?? { rows: 0, totalAmount: 0 }
      bucket.rows += 1
      const amount = Number(row["Сумма, руб."])
      if (Number.isFinite(amount)) bucket.totalAmount += amount
      unmatched.set(key, bucket)
      continue
    }

    for (const artist of trackArtists) {
      const share = calculateArtistShare(
        row["Код"], artist, trackArtists, index.artistsData, royaltyShares, trackRoyaltyShares
      )
      const amountShare = Number(row["Сумма, руб."]) * share
      const key = trackKeyOf(row)

      let tracks = artistsTracks.get(artist)
      if (!tracks) {
        tracks = new Map()
        artistsTracks.set(artist, tracks)
      }
      const existing = tracks.get(key)
      if (existing) {
        existing.quantity += Number(row["Количество"])
        existing.amount += amountShare
        // Доля именно присваивается: при нескольких строках одного трека
        // остаётся значение последней. Так вёл себя питон.
        existing.share = share * 100
      } else {
        tracks.set(key, {
          trackCode: row["Код"],
          performer: row["Исполнитель"],
          name: row["Наименование"],
          album: row["Альбом"],
          quantity: Number(row["Количество"]),
          amount: amountShare,
          share: share * 100,
        })
      }
    }
  }

  const metadata: ReportMetadata[] = []
  const createdFiles: string[] = []

  for (const [artist, tracks] of artistsTracks) {
    const data = index.artistsData.get(artist)
    if (!data) {
      logs.push(`⚠️  Пропущен артист ${artist}: не найден в списке артистов с процентом`)
      continue
    }

    const safeName = sanitizeFileName(artist)
    const fileName = `${safeName}.xlsx`
    const filePath = path.join(reportsDir, fileName)
    const isRegistered = index.registeredNames.has(artist)

    logs.push(
      `Создаем отчет для ${isRegistered ? "зарегистрированного" : "незарегистрированного"} артиста: ${artist}`
    )

    const trackList = [...tracks.values()]
    const totalAmountRaw = trackList.reduce((sum, t) => sum + t.amount, 0)
    const totalAmount = pyRound(totalAmountRaw, 2)

    const { fraction, text } = parsePercentage(data.percentage)
    // Округление дважды: сначала сумма, затем результат умножения. Если считать
    // от неокруглённой суммы, копейки разойдутся с прежними отчётами.
    const finalAmount = pyRound(totalAmount * fraction, 2)

    const buffer = await buildArtistReport(
      templatePath,
      {
        quarterLabel, periodLabel, artistName: artist,
        contract: data.contract, fio: data.fio, fioShort: data.fioShort,
        totalAmount, percentageText: text, finalAmount, approvalDate,
      },
      trackList
    )
    await writeFile(filePath, buffer)
    createdFiles.push(filePath)

    const totalPlays = trackList.reduce((sum, t) => sum + t.quantity, 0)
    metadata.push({
      id: `report_${artist}_${quarter}_${year}_${Math.floor(Date.now() / 1000)}_${metadata.length}`,
      artistId: isRegistered && data.id ? data.id : null,
      artistName: artist,
      quarter,
      year,
      fileName,
      filePath,
      uploadDate: new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z"),
      status: "processed",
      totalPlays,
      totalAmount: finalAmount,
      isRegistered,
      isSigned: false,
      isPaid: false,
      isAcknowledged: false,
    })
  }

  const unmatchedArtists = [...unmatched.entries()]
    .map(([trackArtist, data]) => ({
      trackArtist,
      rows: data.rows,
      totalAmount: pyRound(data.totalAmount, 2),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)

  logs.push(`✅ Создано отчётов: ${metadata.length}`)

  return {
    metadata,
    createdFiles,
    incompleteArtists: incompleteInStatement,
    unmatchedArtists: unmatchedArtists.slice(0, UNMATCHED_LIMIT),
    unmatchedTruncated: unmatchedArtists.length > UNMATCHED_LIMIT,
    logs,
  }
}
