/**
 * Простой in-memory rate limit для API (один инстанс Node).
 * На нескольких репликах используйте Redis / edge limiter.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

export function rateLimitLogin(key: string): { ok: boolean; retryAfterSec?: number } {
  return rateLimit(`login:${key}`, 10, WINDOW_MS)
}

export function rateLimitParser(key: string): { ok: boolean; retryAfterSec?: number } {
  return rateLimit(`parser:${key}`, MAX_PER_WINDOW, WINDOW_MS)
}

const PUBLIC_FORM_WINDOW_MS = 60_000
const PUBLIC_FORM_HOUR_MS = 3_600_000

function envPositiveInt(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** Публичные формы: per-IP минутный и часовой лимит (env override for staging/E2E). */
export function rateLimitPublicForm(ip: string): { ok: boolean; retryAfterSec?: number } {
  const maxPerMin = envPositiveInt("PUBLIC_FORM_MAX_PER_MIN", 20)
  const maxPerHour = envPositiveInt("PUBLIC_FORM_MAX_PER_HOUR", 200)
  const min = rateLimit(`pubform:min:${ip}`, maxPerMin, PUBLIC_FORM_WINDOW_MS)
  if (!min.ok) return min
  return rateLimit(`pubform:hr:${ip}`, maxPerHour, PUBLIC_FORM_HOUR_MS)
}

function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count += 1
  if (b.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  return { ok: true }
}
