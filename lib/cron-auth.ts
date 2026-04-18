import type { NextRequest } from 'next/server'

/**
 * Секрет cron: предпочтительно Authorization: Bearer (не попадает в access-log как query).
 * Query ?secret= оставлен для обратной совместимости.
 *
 * Важно: при `next build` / Docker build переменные из панели хостинга не подставляются —
 * CRON_SECRET есть только в рантайме контейнера; не логируйте «секрет не задан» на этапе импорта модулей.
 */
export function getCronProvidedSecret(request: NextRequest): string | undefined {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  const q = request.nextUrl.searchParams.get('secret')
  return q?.trim() || undefined
}

export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = getCronProvidedSecret(request)
  return provided === expected
}

/** Server-to-server: JSON POST с тем же секретом, что и Vercel Cron */
export function internalCronFetchJsonHeaders(): HeadersInit {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is not set')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  }
}

/** Только Bearer (например GET /api/playlists/sftp из server route) */
export function internalCronAuthHeaderOnly(): HeadersInit {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is not set')
  return { Authorization: `Bearer ${secret}` }
}
