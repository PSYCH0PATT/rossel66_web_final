import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { analyticsSyncBodySchema } from '@/lib/api-schemas'
import {
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

    lockHeld = await tryAcquireFlashImportLock()
    if (!lockHeld) {
      return NextResponse.json(
        { success: false, error: 'Импорт уже выполняется (advisory lock)' },
        { status: 409 }
      )
    }

    console.log(
      `[analytics/sync] direct import ${body.startDate?.trim() && body.endDate?.trim() ? `range ${body.startDate}…${body.endDate}` : `mode=${mode}`}`
    )

    const { status, body: result } = await runAnalyticsFlashSftpImport(
      {
        mode,
        startDate: body.startDate,
        endDate: body.endDate,
      },
      startTime
    )
    console.log(`[analytics/sync] done status=${status} success=${result.success}`)
    return NextResponse.json(result, { status })
  } catch (error) {
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
      await releaseFlashImportLock()
    }
  }
}

export const runtime = 'nodejs'
