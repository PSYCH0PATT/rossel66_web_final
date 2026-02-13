import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore
import SftpClient from 'ssh2-sftp-client'
import * as fs from 'fs'
import * as path from 'path'
import { parseFlashCSV } from '@/lib/flash-parser'
import { saveFlashRecords } from '@/lib/flash-storage'
import { addActivity } from '@/lib/storage'

const CRON_SECRET = process.env.CRON_SECRET
const REMOTE_PATH = 'rossel_flash'
const DOWNLOADS_DIR = path.join(process.cwd(), 'sftp_downloads')

/**
 * GET /api/cron/analytics-flash
 * Cron задача: скачивает CSV из /rossel_flash по SFTP,
 * парсит и сохраняет в StreamAnalytics.
 *
 * Query params:
 *   secret — секрет авторизации
 *   mode   — "all" для скачивания ВСЕХ файлов, "latest" (по умолчанию) для последнего
 *
 * Расписание: 20:00 MSK ежедневно (mode=latest)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.nextUrl.searchParams.get('secret')
    const providedSecret = authHeader?.replace('Bearer ', '') || cronSecret

    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const mode = request.nextUrl.searchParams.get('mode') || 'latest'

    console.log('')
    console.log('═══════════════════════════════════════════════════')
    console.log(`📊 ANALYTICS FLASH IMPORT (mode: ${mode})`)
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
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
        readyTimeout: 20000,
      })
      console.log('✅ Подключено к SFTP')

      // Список файлов
      const files = await sftp.list(REMOTE_PATH)
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
          message: 'Нет CSV файлов в rossel_flash',
          stats: { downloaded: 0, parsed: 0, added: 0, skipped: 0 }
        })
      }

      // Сортируем по дате (от старого к новому для all, или берём последний)
      csvFiles.sort((a, b) => a.date!.localeCompare(b.date!))

      const filesToProcess = mode === 'all' ? csvFiles : [csvFiles[csvFiles.length - 1]]
      console.log(`📋 Файлов для обработки: ${filesToProcess.length} из ${csvFiles.length}`)

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

          // Скачиваем если ещё нет локально
          if (!fs.existsSync(localPath)) {
            console.log(`⬇️  Скачиваю: ${file.name}...`)
            await sftp.fastGet(`${REMOTE_PATH}/${file.name}`, localPath)
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

      // Логируем активность
      addActivity({
        type: 'analytics_import',
        userId: 'system',
        userRole: 'admin',
        title: mode === 'all' ? 'Полный импорт аналитики Flash' : 'Импорт аналитики Flash',
        description: `Обработано ${filesToProcess.length} файлов: добавлено ${totalAdded} записей, пропущено ${totalSkipped} дубликатов`,
        metadata: {
          mode,
          filesProcessed: filesToProcess.length,
          totalParsed,
          totalAdded,
          totalSkipped,
          duration: `${duration}ms`,
        },
      })

      console.log('')
      console.log('═══════════════════════════════════════════════════')
      console.log(`✅ Импорт завершён за ${duration}ms`)
      console.log(`   Файлов: ${filesToProcess.length}, Добавлено: ${totalAdded}, Пропущено: ${totalSkipped}`)
      console.log('═══════════════════════════════════════════════════')

      return NextResponse.json({
        success: true,
        message: `Импорт завершён: ${totalAdded} новых записей из ${filesToProcess.length} файлов`,
        stats: {
          mode,
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
  }
}

export const runtime = 'nodejs'
