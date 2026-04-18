// @ts-ignore — типы connectOpts от withIpv4SocketIfRequested
import SftpClient from 'ssh2-sftp-client'
import * as fs from 'fs'
import * as path from 'path'
import { parseFlashCSV } from '@/lib/flash-parser'
import { saveFlashRecords } from '@/lib/flash-storage'
import {
  resolveFlashRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from '@/lib/sftp-connect'
import { prisma } from '@/lib/prisma'

const FAST_GET_TIMEOUT_MS = 120_000
const DOWNLOADS_DIR = path.join(process.cwd(), 'sftp_downloads')
export const DAYS_BACK_DEFAULT = 7

/** Сегодня по календарю Europe/Moscow (как в именах rossel_flash_YYYY_MM_DD.csv). */
export function mskTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Календарное смещение YYYY-MM-DD (UTC-компоненты даты, без времени суток). */
export function addDaysToYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const u = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return u.toISOString().slice(0, 10)
}

export type FlashImportParams = {
  mode: string
  startDate?: string | null
  endDate?: string | null
}

export type FlashImportHttpResult = {
  status: number
  body: Record<string, unknown>
}

export async function tryAcquireFlashImportLock(): Promise<boolean> {
  const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT pg_try_advisory_lock(88442201, 103) AS ok
  `
  return lockRows[0]?.ok === true
}

export async function releaseFlashImportLock(): Promise<void> {
  try {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(88442201, 103)`
  } catch {
    /* ignore */
  }
}

/**
 * Скачивание и импорт rossel_flash с SFTP (без HTTP, без проверки cron/admin).
 * Вызывающий обязан взять advisory lock или обеспечить одиночный запуск.
 */
export async function runAnalyticsFlashSftpImport(
  params: FlashImportParams,
  startTime: number
): Promise<FlashImportHttpResult> {
  const mode = params.mode || '7days'
  const startDate = params.startDate?.trim() || null
  const endDate = params.endDate?.trim() || null

  const sftpConfig = {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username: process.env.SFTP_USERNAME || '',
    password: process.env.SFTP_PASSWORD || '',
  }

  if (!sftpConfig.username || !sftpConfig.password) {
    return {
      status: 500,
      body: { success: false, error: 'SFTP credentials not configured' },
    }
  }

  const sftp = new SftpClient()
  try {
    const connectOpts = await withIpv4SocketIfRequested(
      sftpConnectOptions({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      })
    )
    await sftp.connect(connectOpts as any)
    console.log('✅ Подключено к SFTP')

    const flashDir = await resolveFlashRemoteDir(sftp)
    if (!flashDir) {
      await sftp.end().catch(() => {})
      return {
        status: 500,
        body: {
          success: false,
          error:
            'SFTP: не найден каталог rossel_flash (проверьте SFTP_REMOTE_FLASH_PATH и права)',
        },
      }
    }
    console.log(`📁 Каталог аналитики на сервере: ${flashDir}`)

    const files = await sftp.list(flashDir)
    const csvFiles = (files as { type?: string; name: string }[])
      .filter((f) => f.type === '-' && f.name.toLowerCase().endsWith('.csv'))
      .map((f) => {
        const m = f.name.match(/rossel_flash_(\d{4})_(\d{2})_(\d{2})\.csv$/i)
        return {
          name: f.name,
          date: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
        }
      })
      .filter((f) => f.date)

    if (csvFiles.length === 0) {
      await sftp.end()
      return {
        status: 200,
        body: {
          success: true,
          message: `Нет CSV файлов в ${flashDir}`,
          stats: { downloaded: 0, parsed: 0, added: 0, skipped: 0 },
        },
      }
    }

    csvFiles.sort((a, b) => a.date!.localeCompare(b.date!))

    const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

    let filesToProcess: typeof csvFiles
    if (startDate && endDate) {
      if (!isoDate(startDate) || !isoDate(endDate)) {
        await sftp.end().catch(() => {})
        return {
          status: 400,
          body: {
            success: false,
            error: 'Неверный формат startDate или endDate (нужен YYYY-MM-DD)',
          },
        }
      }
      if (startDate > endDate) {
        await sftp.end().catch(() => {})
        return {
          status: 400,
          body: { success: false, error: 'startDate не может быть позже endDate' },
        }
      }
      filesToProcess = csvFiles.filter(
        (f) => f.date! >= startDate && f.date! <= endDate
      )
    } else if (mode === 'all') {
      filesToProcess = csvFiles
    } else if (mode === 'latest') {
      filesToProcess =
        csvFiles.length > 0 ? [csvFiles[csvFiles.length - 1]] : []
    } else if (mode === 'today') {
      const todayMsk = mskTodayYmd()
      filesToProcess = csvFiles.filter((f) => f.date === todayMsk)
    } else {
      // Последние N календарных дней по МСК (даты в имени файла — отчётный день МСК)
      const todayMsk = mskTodayYmd()
      const cutoffStr = addDaysToYmd(todayMsk, -DAYS_BACK_DEFAULT)
      filesToProcess = csvFiles.filter((f) => f.date! >= cutoffStr)
      const newest = csvFiles[csvFiles.length - 1]?.date
      console.log(
        `📅 Режим 7days (МСК): сегодня=${todayMsk}, cutoff>=${cutoffStr}, новейший файл на SFTP=${newest ?? '—'}`
      )
    }

    console.log(`📋 Файлов для обработки: ${filesToProcess.length} из ${csvFiles.length}`)

    if (filesToProcess.length === 0) {
      await sftp.end().catch(() => {})
      const duration = Date.now() - startTime
      const statsMode =
        startDate && endDate ? 'range' : mode === 'today' ? 'today' : mode
      const hint =
        mode === 'today'
          ? 'За сегодня (МСК) на SFTP нет подходящего CSV.'
          : startDate && endDate
            ? 'В указанном диапазоне нет файлов rossel_flash.'
            : mode === '7days'
              ? `Нет CSV за последние ${DAYS_BACK_DEFAULT} календарных дней (МСК). Попробуйте режим «Все» или укажите период.`
              : 'Нет файлов для выбранного режима.'
      return {
        status: 200,
        body: {
          success: true,
          message: hint,
          stats: {
            mode: statsMode,
            dateFrom: startDate && endDate ? startDate : undefined,
            dateTo: startDate && endDate ? endDate : undefined,
            filesProcessed: 0,
            totalAvailable: csvFiles.length,
            totalParsed: 0,
            totalAdded: 0,
            totalSkipped: 0,
            files: [],
          },
          duration: `${duration}ms`,
        },
      }
    }

    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    }

    let totalParsed = 0
    let totalAdded = 0
    let totalSkipped = 0
    const fileResults: Array<{
      name: string
      date: string
      parsed: number
      added: number
      skipped: number
    }> = []

    for (const file of filesToProcess) {
      try {
        const localPath = path.join(DOWNLOADS_DIR, file.name)
        const forceDownload =
          mode === '7days' ||
          mode === 'today' ||
          mode === 'all' ||
          !!(startDate && endDate)
        if (forceDownload || !fs.existsSync(localPath)) {
          console.log(`⬇️  Скачиваю: ${file.name}...`)
          const dl = sftp.fastGet(path.posix.join(flashDir, file.name), localPath)
          const timeout = new Promise<never>((_, rej) =>
            setTimeout(
              () =>
                rej(new Error(`SFTP fastGet timeout (${FAST_GET_TIMEOUT_MS}ms)`)),
              FAST_GET_TIMEOUT_MS
            )
          )
          await Promise.race([dl, timeout])
        } else {
          console.log(`📁 Уже скачан: ${file.name}`)
        }

        const records = parseFlashCSV(localPath)
        const saveResult = await saveFlashRecords(records)

        console.log(
          `   📊 ${file.name}: ${records.length} записей → добавлено ${saveResult.added}, пропущено ${saveResult.skipped}`
        )

        totalParsed += records.length
        totalAdded += saveResult.added
        totalSkipped += saveResult.skipped

        fileResults.push({
          name: file.name,
          date: file.date!,
          parsed: records.length,
          added: saveResult.added,
          skipped: saveResult.skipped,
        })
      } catch (fileError) {
        console.error(`❌ Ошибка обработки ${file.name}:`, fileError)
        fileResults.push({
          name: file.name,
          date: file.date!,
          parsed: 0,
          added: 0,
          skipped: 0,
        })
      }
    }

    await sftp.end()

    const duration = Date.now() - startTime
    const statsMode =
      startDate && endDate ? 'range' : mode === 'today' ? 'today' : mode

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log(`✅ Импорт завершён за ${duration}ms`)
    console.log(
      `   Файлов: ${filesToProcess.length}, Добавлено: ${totalAdded}, Пропущено: ${totalSkipped}`
    )
    console.log('═══════════════════════════════════════════════════')

    return {
      status: 200,
      body: {
        success: true,
        message: `Импорт завершён: ${totalAdded} новых записей из ${filesToProcess.length} файлов`,
        stats: {
          mode: statsMode,
          dateFrom: startDate && endDate ? startDate : undefined,
          dateTo: startDate && endDate ? endDate : undefined,
          filesProcessed: filesToProcess.length,
          totalAvailable: csvFiles.length,
          totalParsed,
          totalAdded,
          totalSkipped,
          files: fileResults,
        },
        duration: `${duration}ms`,
      },
    }
  } catch (sftpError) {
    try {
      await sftp.end()
    } catch {
      /* ignore */
    }
    throw sftpError
  }
}
