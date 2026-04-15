import { NextRequest, NextResponse } from 'next/server'

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
 * Базовый URL: сначала loopback (надёжно из Docker за reverse-proxy), иначе NEXT_PUBLIC_BASE_URL,
 * иначе заголовки запроса.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: string
      startDate?: string
      endDate?: string
    }
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
    q.set('secret', cronSecret)
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
      `[analytics/sync] ${sd && ed ? `range ${sd}…${ed}` : `mode=${mode}`} → GET ${cronUrl.replace(cronSecret, '***')}`
    )

    const res = await fetch(cronUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

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
