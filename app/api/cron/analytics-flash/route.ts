import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import SftpClient from 'ssh2-sftp-client'
import * as fs from 'fs'
import * as path from 'path'
import { parseFlashCSV } from '@/lib/flash-parser'
import { saveFlashRecords } from '@/lib/flash-storage'
import { addActivity } from '@/lib/storage'
import {
  resolveFlashRemoteDir,
  sftpConnectOptions,
  withIpv4SocketIfRequested,
} from '@/lib/sftp-connect'
import { isCronAuthorized } from '@/lib/cron-auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const FAST_GET_TIMEOUT_MS = 120_000
const DOWNLOADS_DIR = path.join(process.cwd(), 'sftp_downloads')

const DAYS_BACK_DEFAULT = 7

/**
 * GET /api/cron/analytics-flash
 * Cron задача: скачивает CSV из /rossel_flash по SFTP,
 * парсит и сохраняет в StreamAnalytics. Дубликаты не создаются — добавляются только новые записи.
 *
 * Query params:
 *   secret — секрет авторизации
 *   mode   — "7days" (по умолчанию) за последние 7 дней,
 *            "latest" только последний файл, "all" все файлы,
 *            "today" только файл за календарный сегодня (Europe/Moscow)
 *   startDate, endDate — YYYY-MM-DD; если оба заданы, только файлы rossel_flash в этом диапазоне (приоритет над mode)
 *
 * Расписание: 20:00 MSK ежедневно (mode=7days)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  let advisoryHeld = false
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const lockRows = await prisma.$queryRaw<{ ok: boolean }[]>`
      SELECT pg_try_advisory_lock(88442201, 103) AS ok
    `
    advisoryHeld = lockRows[0]?.ok === true
    if (!advisoryHeld) {
      return NextResponse.json(
        { success: false, error: 'Импорт уже выполняется (advisory lock)' },
        { status: 409 }
      )
    }

    const mode = request.nextUrl.searchParams.get('mode') || '7days'
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log(
      `📊 ANALYTICS FLASH IMPORT (mode: ${mode}${startDate && endDate ? `, range ${startDate}…${endDate}` : ''})`
    )
    console.log('═══════════════════════════════════════════════════')
    console.log(`📅 Время запуска: ${new Date().toISOString()}`)

    // SFTP config
    const sftpConfig = {
      host: process.env.SFTP_HOST || 'sftp1.sp-digital.ru',
      port: parseInt(process.env.SFTP_PORT || '22', 10),
      username: process.env.SFTP_USERNAME || '',
      password: process.env.SFTP_PASSWORD || '',
    }

    if (!sftpConfig.username || !sftpConfig.password) {
      return NextResponse.json({
        success: false,
        error: 'SFTP credentials not configured',
      }, { status: 500 })
    }

    // Подключаемся к SFTP
    const sftp = new SftpClient()
    try {
      console.log(`🔌 Подключение к ${sftpConfig.host}:${sftpConfig.port}...`)
      const connectOpts = await withIpv4SocketIfRequested(
        sftpConnectOptions({
          host: sftpConfig.host,
          port: sftpConfig.port,
          username: sftpConfig.username,
          password: sftpConfig.password,
        })
      )
      // ssh2-sftp-client типы не совпадают с Record+sock из withIpv4SocketIfRequested
      await sftp.connect(connectOpts as any)
      console.log('✅ Подключено к SFTP')

      const flashDir = await resolveFlashRemoteDir(sftp)
      if (!flashDir) {
        await sftp.end().catch(() => {})
        return NextResponse.json(
          {
            success: false,
            error: 'SFTP: не найден каталог rossel_flash (проверьте SFTP_REMOTE_FLASH_PATH и права)',
          },
          { status: 500 }
        )
      }
      console.log(`📁 Каталог аналитики на сервере: ${flashDir}`)

      // Список файлов
      const files = await sftp.list(flashDir)
      const csvFiles = (files as any[])
        .filter((f: any) => f.type === '-' && f.name.endsWith('.csv'))
        .map((f: any) => {
          const m = f.name.match(/rossel_flash_(\d{4})_(\d{2})_(\d{2})\.csv$/)
          return {
            name: f.name,
            date: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
          }
        })
        .filter(f => f.date)

      if (csvFiles.length === 0) {
        await sftp.end()
        return NextResponse.json({
          success: true,
          message: `Нет CSV файлов в ${flashDir}`,
          stats: { downloaded: 0, parsed: 0, added: 0, skipped: 0 }
        })
      }

      // Сортируем по дате (от старого к новому)
      csvFiles.sort((a, b) => a.date!.localeCompare(b.date!))

      const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

      let filesToProcess: typeof csvFiles
      if (startDate && endDate) {
        if (!isoDate(startDate) || !isoDate(endDate)) {
          await sftp.end().catch(() => {})
          return NextResponse.json(
            {
              success: false,
              error: 'Неверный формат startDate или endDate (нужен YYYY-MM-DD)',
            },
            { status: 400 }
          )
        }
        if (startDate > endDate) {
          await sftp.end().catch(() => {})
          return NextResponse.json(
            { success: false, error: 'startDate не может быть позже endDate' },
            { status: 400 }
          )
        }
        filesToProcess = csvFiles.filter((f) => f.date! >= startDate && f.date! <= endDate)
      } else if (mode === 'all') {
        filesToProcess = csvFiles
      } else if (mode === 'latest') {
        filesToProcess = csvFiles.length > 0 ? [csvFiles[csvFiles.length - 1]] : []
      } else if (mode === 'today') {
        const todayMsk = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Moscow',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date())
        filesToProcess = csvFiles.filter((f) => f.date === todayMsk)
      } else {
        // 7days (по умолчанию): все файлы за последние N дней (площадки дополняются с задержкой)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - DAYS_BACK_DEFAULT)
        const cutoffStr = cutoff.toISOString().split('T')[0]
        filesToProcess = csvFiles.filter((f) => f.date! >= cutoffStr)
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
              : 'Нет файлов для выбранного режима.'
        return NextResponse.json({
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
        })
      }

      if (!fs.existsSync(DOWNLOADS_DIR)) {
        fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
      }

      let totalParsed = 0
      let totalAdded = 0
      let totalSkipped = 0
      const fileResults: Array<{ name: string; date: string; parsed: number; added: number; skipped: number }> = []

      for (const file of filesToProcess) {
        try {
          const localPath = path.join(DOWNLOADS_DIR, file.name)

          // Перекачивать, чтобы подхватить дополненные CSV и восстановление за период
          const forceDownload =
            mode === '7days' ||
            mode === 'today' ||
            mode === 'all' ||
            !!(startDate && endDate)
          if (forceDownload || !fs.existsSync(localPath)) {
            console.log(`⬇️  Скачиваю: ${file.name}...`)
            const dl = sftp.fastGet(path.posix.join(flashDir, file.name), localPath)
            const timeout = new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error(`SFTP fastGet timeout (${FAST_GET_TIMEOUT_MS}ms)`)), FAST_GET_TIMEOUT_MS)
            )
            await Promise.race([dl, timeout])
          } else {
            console.log(`📁 Уже скачан: ${file.name}`)
          }

          // Парсим и сохраняем
          const records = parseFlashCSV(localPath)
          const saveResult = await saveFlashRecords(records)

          console.log(`   📊 ${file.name}: ${records.length} записей → добавлено ${saveResult.added}, пропущено ${saveResult.skipped}`)

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

      console.log('')
      console.log('═══════════════════════════════════════════════════')
      console.log(`✅ Импорт завершён за ${duration}ms`)
      console.log(`   Файлов: ${filesToProcess.length}, Добавлено: ${totalAdded}, Пропущено: ${totalSkipped}`)
      console.log('═══════════════════════════════════════════════════')

      const statsMode =
        startDate && endDate ? 'range' : mode === 'today' ? 'today' : mode

      return NextResponse.json({
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
      })

    } catch (sftpError) {
      try { await sftp.end() } catch { /* ignore */ }
      throw sftpError
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ Analytics Flash cron error:', error)

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: String(error),
      duration: `${duration}ms`,
    }, { status: 500 })
  } finally {
    if (advisoryHeld) {
      try {
        await prisma.$executeRaw`SELECT pg_advisory_unlock(88442201, 103)`
      } catch {
        /* ignore */
      }
    }
  }
}

export const runtime = 'nodejs'
