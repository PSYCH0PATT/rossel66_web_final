import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/playlists/sync-sftp
 * Ручной запуск синхронизации SFTP из админ-интерфейса.
 * Вызывается только с сервера, CRON_SECRET не передаётся с клиента.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET не настроен на сервере' },
      { status: 500 }
    )
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    const response = await fetch(`${baseUrl}/api/cron/playlists-sftp?secret=${encodeURIComponent(secret)}`, {
      cache: 'no-store'
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Playlists sync-sftp proxy error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
