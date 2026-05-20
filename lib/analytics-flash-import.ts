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
const SFTP_END_TIMEOUT_MS = 5_000
const UNLOCK_TIMEOUT_MS = 5_000
const OVERALL_TIMEOUT_MS_DEFAULT = 180_000
const DOWNLOADS_DIR = path.join(process.cwd(), 'sftp_downloads')
export const DAYS_BACK_DEFAULT = 7

/** Единый префикс — grep по логам: `flash-import` */
const LOG = '[flash-import]'

/** Сквозной id запуска (передавайте из route в lock → import → unlock). */
export function flashImportNewRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function elapsed(startTime: number): number {
  return Date.now() - startTime
}

/**
 * Race промиса с таймаутом.
 * Возвращает результат promise, либо `null`, если таймаут сработал раньше.
 * Никогда не throw — используется для «best-effort» операций
 * (sftp.end, pg_advisory_unlock), где висящий await убивает handler.
 */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
  runId?: string
): Promise<T | null> {
  let timer: NodeJS.Timeout | null = null
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(LOG, 'TIMEOUT (handler продолжит без ожидания)', {
        op: label,
        maxMs: ms,
        runId,
        hint:
          label.includes('sftp.end')
            ? 'Раньше здесь залипали при 0 файлов — ssh2-sftp-client'
            : label.includes('unlock')
              ? 'Pooler/Postgres не ответил на pg_advisory_unlock'
              : undefined,
      })
      resolve(null)
    }, ms)
  })
  try {
    return await Promise.race<T | null>([
      p.catch((err) => {
        console.warn(LOG, 'op rejected', { op: label, runId, err: String(err) })
        return null
      }),
      timeout,
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Закрытие SFTP-сессии с жёстким ограничением по времени. */
async function safeEndSftp(
  sftp: SftpClient,
  runId: string,
  reason: string,
  runStartedAt: number
): Promise<void> {
  const t0 = Date.now()
  console.log(LOG, 'sftp.end START', {
    runId,
    reason,
    maxMs: SFTP_END_TIMEOUT_MS,
    elapsedSinceRunStartMs: elapsed(runStartedAt),
  })
  await withTimeout(sftp.end(), SFTP_END_TIMEOUT_MS, 'sftp.end()', runId)
  console.log(LOG, 'sftp.end DONE', { runId, reason, ms: Date.now() - t0 })
}

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

/** Разница в календарных днях между двумя YYYY-MM-DD (a - b). */
function diffDaysYmd(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const au = Date.UTC(ay, am - 1, ad)
  const bu = Date.UTC(by, bm - 1, bd)
  return Math.round((au - bu) / (24 * 60 * 60 * 1000))
}

export type FlashImportParams = {
  mode: string
  startDate?: string | null
  endDate?: string | null
  /** Общий лимит на весь импорт (мс). По умолчанию 180 000. */
  maxDurationMs?: number
  /** Корреляция логов с advisory lock в route */
  runId?: string
}

export type FlashImportHttpResult = {
  status: number
  body: Record<string, unknown>
}

let isFlashImportRunning = false

export async function tryAcquireFlashImportLock(runId?: string): Promise<boolean> {
  const t0 = Date.now()
  console.log(LOG, 'memory_lock_acquire START', { runId })
  
  if (isFlashImportRunning) {
    console.log(LOG, 'memory_lock_acquire FAILED (already running)', { runId, ms: Date.now() - t0 })
    return false
  }
  
  isFlashImportRunning = true
  console.log(LOG, 'memory_lock_acquire DONE', {
    runId,
    acquired: true,
    ms: Date.now() - t0,
  })
  return true
}

/**
 * Освобождение in-memory lock.
 */
export async function releaseFlashImportLock(runId?: string): Promise<void> {
  const t0 = Date.now()
  console.log(LOG, 'memory_lock_release START', { runId })
  isFlashImportRunning = false
  console.log(LOG, 'memory_lock_release DONE', { runId, ms: Date.now() - t0 })
}

/**
 * Скачивание и импорт rossel_flash с SFTP (без HTTP, без проверки cron/admin).
 * Вызывающий обязан взять advisory lock или обеспечить одиночный запуск.
 */
export async function runAnalyticsFlashSftpImport(
  params: FlashImportParams,
  startTime: number
): Promise<FlashImportHttpResult> {
  const runId = params.runId ?? flashImportNewRunId()
  const mode = params.mode || '7days'
  const startDate = params.startDate?.trim() || null
  const endDate = params.endDate?.trim() || null
  const maxDurationMs = params.maxDurationMs ?? OVERALL_TIMEOUT_MS_DEFAULT

  const sftpConfig = {
    host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
    port: parseInt(process.env.SFTP_PORT || '22', 10),
    username: process.env.SFTP_USERNAME || '',
    password: process.env.SFTP_PASSWORD || '',
  }

  console.log(LOG, 'pipeline START', {
    runId,
    mode,
    startDate,
    endDate,
    maxDurationMs,
    host: sftpConfig.host,
    port: sftpConfig.port,
    pid: process.pid,
    ipv4Only: process.env.SFTP_IPV4_ONLY === 'true',
    remoteFlashPath: process.env.SFTP_REMOTE_FLASH_PATH || '(default rossel_flash)',
    elapsedMs: elapsed(startTime),
  })

  if (!sftpConfig.username || !sftpConfig.password) {
    console.warn(LOG, 'abort: SFTP credentials missing', { runId })
    return {
      status: 500,
      body: { success: false, error: 'SFTP credentials not configured' },
    }
  }

  const sftp = new SftpClient()
  try {
    console.log(LOG, 'sftp.connect START', { runId, elapsedMs: elapsed(startTime) })
    const tConnect = Date.now()
    const connectOpts = await withIpv4SocketIfRequested(
      sftpConnectOptions({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      })
    )
    await sftp.connect(connectOpts as any)
    console.log(LOG, 'sftp.connect DONE', {
      runId,
      ms: Date.now() - tConnect,
      elapsedMs: elapsed(startTime),
    })
    console.log('✅ Подключено к SFTP')

    console.log(LOG, 'resolveFlashRemoteDir START', { runId })
    const tDir = Date.now()
    const flashDir = await resolveFlashRemoteDir(sftp)
    console.log(LOG, 'resolveFlashRemoteDir DONE', {
      runId,
      flashDir,
      ms: Date.now() - tDir,
    })
    if (!flashDir) {
      await safeEndSftp(sftp, runId, 'flash_dir_not_found', startTime)
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

    console.log(LOG, 'sftp.list START', { runId, flashDir })
    const tList = Date.now()
    const files = await sftp.list(flashDir)
    const rawEntries = (files as { type?: string; name: string }[]).length
    const csvRows = (files as { type?: string; name: string }[]).filter(
      (f) => f.type === '-' && f.name.toLowerCase().endsWith('.csv')
    )
    const csvFiles = csvRows
      .map((f) => {
        const m = f.name.match(/rossel_flash_(\d{4})_(\d{2})_(\d{2})\.csv$/i)
        return {
          name: f.name,
          date: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
        }
      })
      .filter((f) => f.date)
    const csvSkippedName = csvRows.length - csvFiles.length
    console.log(LOG, 'sftp.list DONE', {
      runId,
      ms: Date.now() - tList,
      rawEntries,
      csvFilesMatchingPattern: csvFiles.length,
      csvRowsButWrongName: csvSkippedName,
      elapsedMs: elapsed(startTime),
    })

    if (csvFiles.length === 0) {
      await safeEndSftp(sftp, runId, 'no_csv_in_dir', startTime)
      return {
        status: 200,
        body: {
          success: true,
          message: `Нет CSV файлов в ${flashDir}`,
          stats: { downloaded: 0, parsed: 0, added: 0, skipped: 0, runId },
        },
      }
    }

    csvFiles.sort((a, b) => a.date!.localeCompare(b.date!))
    const newestAvailable = csvFiles[csvFiles.length - 1]?.date ?? null
    const oldestAvailable = csvFiles[0]?.date ?? null
    const todayMsk = mskTodayYmd()
    const serverLagDays =
      newestAvailable ? Math.max(0, diffDaysYmd(todayMsk, newestAvailable)) : null

    const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

    let filesToProcess: typeof csvFiles
    let selectionBranch = 'unknown'
    if (startDate && endDate) {
      selectionBranch = 'range'
      if (!isoDate(startDate) || !isoDate(endDate)) {
        await safeEndSftp(sftp, runId, 'bad_range_dates', startTime)
        return {
          status: 400,
          body: {
            success: false,
            error: 'Неверный формат startDate или endDate (нужен YYYY-MM-DD)',
          },
        }
      }
      if (startDate > endDate) {
        await safeEndSftp(sftp, runId, 'range_start_after_end', startTime)
        return {
          status: 400,
          body: { success: false, error: 'startDate не может быть позже endDate' },
        }
      }
      filesToProcess = csvFiles.filter(
        (f) => f.date! >= startDate && f.date! <= endDate
      )
    } else if (mode === 'all') {
      selectionBranch = 'all'
      filesToProcess = csvFiles
    } else if (mode === 'latest') {
      selectionBranch = 'latest'
      filesToProcess =
        csvFiles.length > 0 ? [csvFiles[csvFiles.length - 1]] : []
    } else if (mode === 'today') {
      selectionBranch = 'today'
      filesToProcess = csvFiles.filter((f) => f.date === todayMsk)
    } else {
      selectionBranch = '7days'
      // Последние N календарных дней, но cutoff — от самого свежего файла на SFTP,
      // а не от «сегодня». Иначе, если отчёты отстают (обычная ситуация),
      // cron будет каждый день забирать 0 файлов.
      const anchor = newestAvailable ?? todayMsk
      const cutoffStr = addDaysToYmd(anchor, -(DAYS_BACK_DEFAULT - 1))
      filesToProcess = csvFiles.filter((f) => f.date! >= cutoffStr)
      console.log(LOG, '7days window (MSK)', {
        runId,
        today: todayMsk,
        newest: newestAvailable,
        oldestOnSftp: oldestAvailable,
        cutoff: cutoffStr,
        anchor,
        serverLagDays,
        picked: filesToProcess.length,
      })
      console.log(
        `📅 Режим 7days (МСК): сегодня=${todayMsk}, новейший на SFTP=${newestAvailable ?? '—'}, cutoff>=${cutoffStr}${
          serverLagDays !== null ? `, отставание SFTP=${serverLagDays} дн.` : ''
        }`
      )
      if (serverLagDays !== null && serverLagDays > 1) {
        console.warn(LOG, 'SFTP lag vs today (MSK)', {
          runId,
          lagDays: serverLagDays,
          todayMsk,
          newestAvailable,
        })
      }
    }

    console.log(LOG, 'file selection', {
      runId,
      branch: selectionBranch,
      toProcess: filesToProcess.length,
      totalCsvOnSftp: csvFiles.length,
      sample: filesToProcess.slice(0, 3).map((f) => f.name),
    })
    console.log(`📋 Файлов для обработки: ${filesToProcess.length} из ${csvFiles.length}`)

    if (filesToProcess.length === 0) {
      console.log(LOG, 'early return: 0 files after filter', {
        runId,
        branch: selectionBranch,
        todayMsk,
        newestAvailable,
        serverLagDays,
        nextStep: 'sftp.end (was hanging here before timeout wrap)',
      })
      await safeEndSftp(sftp, runId, 'zero_files_after_filter', startTime)
      const duration = Date.now() - startTime
      const statsMode =
        startDate && endDate ? 'range' : mode === 'today' ? 'today' : mode
      const hint =
        mode === 'today'
          ? `За сегодня (МСК ${todayMsk}) на SFTP нет файла. Новейший доступный: ${newestAvailable ?? '—'}${
              serverLagDays !== null && serverLagDays > 0
                ? ` (отставание ${serverLagDays} дн.)`
                : ''
            }`
          : startDate && endDate
            ? `В диапазоне ${startDate}…${endDate} нет файлов rossel_flash. Новейший на SFTP: ${newestAvailable ?? '—'}`
            : mode === '7days'
              ? `Нет CSV за последние ${DAYS_BACK_DEFAULT} дн. относительно новейшего файла на SFTP (${newestAvailable ?? '—'}).${
                  serverLagDays !== null && serverLagDays > 0
                    ? ` SFTP отстаёт от сегодня на ${serverLagDays} дн.`
                    : ''
                }`
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
            newestAvailable,
            serverLagDays,
            runId,
            files: [],
          },
          duration: `${duration}ms`,
        },
      }
    }

    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
      console.log(LOG, 'mkdir downloads', { runId, dir: DOWNLOADS_DIR })
    }

    let totalParsed = 0
    let totalAdded = 0
    let totalSkipped = 0
    let truncated = false
    const fileResults: Array<{
      name: string
      date: string
      parsed: number
      added: number
      skipped: number
    }> = []

    const totalFiles = filesToProcess.length
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i]
      if (Date.now() - startTime > maxDurationMs) {
        truncated = true
        console.warn(LOG, 'OVERALL maxDurationMs exceeded — stopping loop', {
          runId,
          maxDurationMs,
          processedFiles: fileResults.length,
          totalPlanned: totalFiles,
          elapsedMs: elapsed(startTime),
        })
        break
      }
      console.log(LOG, `file ${i + 1}/${totalFiles} START`, {
        runId,
        name: file.name,
        date: file.date,
        elapsedMs: elapsed(startTime),
      })
      try {
        const localPath = path.join(DOWNLOADS_DIR, file.name)
        const forceDownload =
          mode === '7days' ||
          mode === 'today' ||
          mode === 'all' ||
          !!(startDate && endDate)
        if (forceDownload || !fs.existsSync(localPath)) {
          console.log(LOG, 'fastGet START', {
            runId,
            remote: path.posix.join(flashDir, file.name),
            localPath,
            maxMs: FAST_GET_TIMEOUT_MS,
          })
          console.log(`⬇️  Скачиваю: ${file.name}...`)
          const tDl = Date.now()
          const dl = sftp.fastGet(path.posix.join(flashDir, file.name), localPath)
          const timeout = new Promise<never>((_, rej) =>
            setTimeout(
              () =>
                rej(new Error(`SFTP fastGet timeout (${FAST_GET_TIMEOUT_MS}ms)`)),
              FAST_GET_TIMEOUT_MS
            )
          )
          await Promise.race([dl, timeout])
          console.log(LOG, 'fastGet DONE', {
            runId,
            name: file.name,
            ms: Date.now() - tDl,
          })
        } else {
          console.log(LOG, 'skip download (cached file)', { runId, localPath })
          console.log(`📁 Уже скачан: ${file.name}`)
        }

        console.log(LOG, 'parseFlashCSV START', { runId, name: file.name })
        const tParse = Date.now()
        const records = parseFlashCSV(localPath)
        console.log(LOG, 'parseFlashCSV DONE', {
          runId,
          name: file.name,
          rows: records.length,
          ms: Date.now() - tParse,
        })

        console.log(LOG, 'saveFlashRecords START', { runId, name: file.name })
        const tSave = Date.now()
        const saveResult = await saveFlashRecords(records)
        console.log(LOG, 'saveFlashRecords DONE', {
          runId,
          name: file.name,
          added: saveResult.added,
          skipped: saveResult.skipped,
          ms: Date.now() - tSave,
        })

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
        console.log(LOG, `file ${i + 1}/${totalFiles} DONE`, {
          runId,
          name: file.name,
          elapsedMs: elapsed(startTime),
        })
      } catch (fileError) {
        console.error(LOG, `file ${i + 1}/${totalFiles} ERROR`, {
          runId,
          name: file.name,
          err: String(fileError),
        })
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

    console.log(LOG, 'loop finished — closing SFTP', {
      runId,
      truncated,
      processed: fileResults.length,
      planned: totalFiles,
      elapsedMs: elapsed(startTime),
    })
    await safeEndSftp(sftp, runId, 'normal_after_loop', startTime)

    const duration = Date.now() - startTime
    const statsMode =
      startDate && endDate ? 'range' : mode === 'today' ? 'today' : mode

    console.log(LOG, 'pipeline DONE', {
      runId,
      truncated,
      durationMs: duration,
      filesProcessed: fileResults.length,
      totalAdded,
      totalSkipped,
    })
    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log(
      `${truncated ? '⚠️  Импорт прерван по общему таймауту' : '✅ Импорт завершён'} за ${duration}ms`
    )
    console.log(
      `   Файлов: ${fileResults.length}/${filesToProcess.length}, Добавлено: ${totalAdded}, Пропущено: ${totalSkipped}`
    )
    console.log('═══════════════════════════════════════════════════')

    return {
      status: 200,
      body: {
        success: true,
        message: truncated
          ? `Импорт частично завершён (таймаут): ${totalAdded} новых из ${fileResults.length}/${filesToProcess.length} файлов`
          : `Импорт завершён: ${totalAdded} новых записей из ${filesToProcess.length} файлов`,
        stats: {
          mode: statsMode,
          dateFrom: startDate && endDate ? startDate : undefined,
          dateTo: startDate && endDate ? endDate : undefined,
          filesProcessed: fileResults.length,
          totalAvailable: csvFiles.length,
          totalParsed,
          totalAdded,
          totalSkipped,
          newestAvailable,
          serverLagDays,
          truncated,
          runId,
          files: fileResults,
        },
        duration: `${duration}ms`,
      },
    }
  } catch (sftpError) {
    console.error(LOG, 'pipeline THROW — closing SFTP then rethrow', {
      runId,
      err: String(sftpError),
      elapsedMs: elapsed(startTime),
    })
    await safeEndSftp(sftp, runId, 'error_path', startTime)
    throw sftpError
  }
}
