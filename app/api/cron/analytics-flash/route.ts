import { NextRequest, NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cron-auth'
import {
  flashImportNewRunId,
  releaseFlashImportLock,
  runAnalyticsFlashSftpImport,
  tryAcquireFlashImportLock,
} from '@/lib/analytics-flash-import'

export const dynamic = 'force-dynamic'

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
  const runId = flashImportNewRunId()
  let lockHeld = false
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    lockHeld = await tryAcquireFlashImportLock(runId)
    if (!lockHeld) {
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

    const sftpHost = process.env.SFTP_HOST || 'sftp1.sp-digital.ru'
    const sftpPort = parseInt(process.env.SFTP_PORT || '22', 10)
    console.log(`🔌 Подключение к ${sftpHost}:${sftpPort}...`)

    const { status, body } = await runAnalyticsFlashSftpImport(
      { mode, startDate, endDate, runId },
      startTime
    )
    return NextResponse.json(body, { status })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[flash-import] cron route ERROR', { runId, durationMs: duration, err: String(error) })
    console.error('❌ Analytics Flash cron error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: String(error),
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  } finally {
    if (lockHeld) {
      console.log('[flash-import]', 'cron route finally → releaseFlashImportLock', {
        runId,
        elapsedMs: Date.now() - startTime,
      })
      await releaseFlashImportLock(runId)
      console.log('[flash-import]', 'cron route finally done', { runId })
    }
  }
}

export const runtime = 'nodejs'
