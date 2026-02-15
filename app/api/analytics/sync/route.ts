import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/analytics/sync
 * Ручной запуск синхронизации аналитики из SFTP.
 * Проксирует вызов к /api/cron/analytics-flash с нужным секретом.
 *
 * Body (JSON):
 *   mode — "7days" (по умолчанию) за последние 7 дней, "latest" для последнего, "all" для всех
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const mode = body.mode || '7days'
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({
        success: false,
        error: 'CRON_SECRET не настроен на сервере'
      }, { status: 500 })
    }

    // Определяем базовый URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    // Вызываем cron endpoint
    const res = await fetch(`${baseUrl}/api/cron/analytics-flash?secret=${cronSecret}&mode=${mode}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await res.json()
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
