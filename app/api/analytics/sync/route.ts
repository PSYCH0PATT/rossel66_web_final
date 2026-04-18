import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server-auth'
import { analyticsSyncBodySchema } from '@/lib/api-schemas'

export const dynamic = 'force-dynamic'

/**
 * POST /api/analytics/sync
 * Ручной запуск синхронизации аналитики из SFTP.
 * Проксирует вызов к /api/cron/analytics-flash с нужным секретом.
 *
 * Body (JSON):
 *   mode — "7days" | "latest" | "all" | "today"
 *   startDate, endDate — опционально YYYY-MM-DD; если оба заданы, импорт только файлов за этот период (приоритет над mode)
 *
 * Базовый URL: `INTERNAL_CRON_BASE_URL` или `http://127.0.0.1:${PORT}`.
 * На проде за nginx при необходимости задайте INTERNAL_CRON_BASE_URL на реальный loopback:порт приложения.
 */
export async function POST(request: NextRequest) {
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
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.warn('[analytics/sync] CRON_SECRET не задан')
      return NextResponse.json({
        success: false,
        error: 'CRON_SECRET не настроен на сервере'
      }, { status: 500 })
    }

    const port = process.env.PORT || '3000'
    // Loopback надёжнее, чем публичный Host за nginx: иначе fetch к самому себе часто падает/виснет без логов.
    const baseUrl = (process.env.INTERNAL_CRON_BASE_URL || `http://127.0.0.1:${port}`).replace(
      /\/$/,
      ''
    )

    const q = new URLSearchParams()
    const sd = body.startDate?.trim()
    const ed = body.endDate?.trim()
    if (sd && ed) {
      q.set('startDate', sd)
      q.set('endDate', ed)
    } else {
      q.set('mode', String(mode))
    }
    const cronUrl = `${baseUrl}/api/cron/analytics-flash?${q.toString()}`
    console.log(
      `[analytics/sync] ${sd && ed ? `range ${sd}…${ed}` : `mode=${mode}`} → GET ${cronUrl} (Authorization: Bearer ***)`
    )

    const CRON_FETCH_MS = 90_000
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CRON_FETCH_MS)
    let res: Response
    try {
      res = await fetch(cronUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timer)
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') {
        console.error('[analytics/sync] cron fetch aborted (timeout)')
        return NextResponse.json(
          {
            success: false,
            error: 'Cron timeout (>90s)',
            hint: 'Проверьте SFTP и INTERNAL_CRON_BASE_URL; при большом объёме CSV импорт может занять дольше.',
          },
          { status: 504 }
        )
      }
      throw err
    }
    clearTimeout(timer)

    const text = await res.text()
    let result: Record<string, unknown>
    try {
      result = JSON.parse(text) as Record<string, unknown>
    } catch {
      console.error('[analytics/sync] ответ не JSON:', text.slice(0, 500))
      return NextResponse.json(
        {
          success: false,
          error: 'Некорректный ответ от cron',
          details: text.slice(0, 200),
        },
        { status: 502 }
      )
    }

    console.log(`[analytics/sync] cron status=${res.status} success=${result.success}`)
    return NextResponse.json(result, { status: res.status })

  } catch (error) {
    console.error('❌ Ошибка ручной синхронизации аналитики:', error)
    return NextResponse.json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: String(error),
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
