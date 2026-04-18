import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { analyticsSyncBodySchema } from '@/lib/api-schemas'
import {
  flashImportNewRunId,
  releaseFlashImportLock,
  runAnalyticsFlashSftpImport,
  tryAcquireFlashImportLock,
} from '@/lib/analytics-flash-import'

export const dynamic = 'force-dynamic'

/**
 * POST /api/analytics/sync
 * Ручной запуск синхронизации аналитики из SFTP (тот же пайплайн, что GET /api/cron/analytics-flash),
 * без HTTP self-fetch — иначе на проде возможен таймаут 90s и зависания loopback.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const runId = flashImportNewRunId()
  let lockHeld = false
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const raw = await request.json().catch(() => ({}))
    const parsed = analyticsSyncBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Некорректное тело запроса', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data
    const mode = body.mode || '7days'

    lockHeld = await tryAcquireFlashImportLock(runId)
    if (!lockHeld) {
      return NextResponse.json(
        { success: false, error: 'Импорт уже выполняется (advisory lock)' },
        { status: 409 }
      )
    }

    console.log('[flash-import] analytics/sync import', {
      runId,
      kind: body.startDate?.trim() && body.endDate?.trim()
        ? `range ${body.startDate}…${body.endDate}`
        : `mode=${mode}`,
    })

    const { status, body: result } = await runAnalyticsFlashSftpImport(
      {
        mode,
        startDate: body.startDate,
        endDate: body.endDate,
        runId,
      },
      startTime
    )
    console.log('[flash-import] analytics/sync done', {
      runId,
      status,
      success: result.success,
      elapsedMs: Date.now() - startTime,
    })
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('[flash-import] analytics/sync ERROR', { runId, err: String(error) })
    console.error('❌ Ошибка ручной синхронизации аналитики:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Внутренняя ошибка сервера',
        details: String(error),
      },
      { status: 500 }
    )
  } finally {
    if (lockHeld) {
      console.log('[flash-import]', 'analytics/sync finally → releaseFlashImportLock', {
        runId,
        elapsedMs: Date.now() - startTime,
      })
      await releaseFlashImportLock(runId)
      console.log('[flash-import]', 'analytics/sync finally done', { runId })
    }
  }
}

export const runtime = 'nodejs'
