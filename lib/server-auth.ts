import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createHmac, timingSafeEqual } from "crypto"
import { isCronAuthorized } from "@/lib/cron-auth"

export interface SessionUser {
  id: string
  username: string
  role: "admin" | "artist"
}

const COOKIE = "rossel_session"

function parseLegacySession(raw: string): SessionUser | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"))
    if (!parsed?.id || !parsed?.role) return null
    return parsed as SessionUser
  } catch {
    return null
  }
}

function parseSignedSession(raw: string, secret: string): SessionUser | null {
  const dot = raw.indexOf(".")
  if (dot <= 0) return null
  const payloadB64 = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!payloadB64 || !sig) return null
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url")
  try {
    const sigBytes = new TextEncoder().encode(sig)
    const expBytes = new TextEncoder().encode(expected)
    if (sigBytes.length !== expBytes.length || !timingSafeEqual(sigBytes, expBytes)) {
      return null
    }
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"))
    if (!parsed?.id || !parsed?.role) return null
    return parsed as SessionUser
  } catch {
    return null
  }
}

/**
 * Reads the current user from the httpOnly session cookie.
 * With AUTH_SECRET: HMAC-signed cookie (payload.sig, base64url).
 * Legacy: plain base64 JSON — only if AUTH_SECRET unset, or ALLOW_LEGACY_UNSIGNED_SESSION=true.
 */
export function getSessionUser(): SessionUser | null {
  try {
    const cookieStore = cookies()
    const raw = cookieStore.get(COOKIE)?.value
    if (!raw) return null
    const secret = process.env.AUTH_SECRET?.trim()
    if (secret) {
      const signed = parseSignedSession(raw, secret)
      if (signed) return signed
      if (process.env.ALLOW_LEGACY_UNSIGNED_SESSION === "true") {
        return parseLegacySession(raw)
      }
      return null
    }
    return parseLegacySession(raw)
  } catch {
    return null
  }
}

export async function requireAuth(_request?: Request): Promise<NextResponse | null> {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  return null
}

/** Alias */
export const requireUser = requireAuth

export async function requireAdmin(_request?: Request): Promise<NextResponse | null> {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }
  return null
}

/** Админская сессия или внутренний вызов с CRON_SECRET (Bearer / ?secret=). */
export async function requireAdminOrCron(request: NextRequest): Promise<NextResponse | null> {
  if (isCronAuthorized(request)) return null
  return requireAdmin(request)
}

export async function requireSelfOrAdmin(
  _request: Request | undefined,
  artistId: string
): Promise<NextResponse | null> {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  if (user.role !== "admin" && user.id !== artistId) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }
  return null
}

/**
 * Signed session value for Set-Cookie.
 * Without AUTH_SECRET: legacy base64 JSON (dev / migration).
 */
export function buildSessionCookieValue(user: SessionUser): string {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[auth] AUTH_SECRET не задан — сессия без подписи. Задайте AUTH_SECRET на проде."
      )
    }
    return Buffer.from(JSON.stringify(user), "utf-8").toString("base64")
  }
  const payload = Buffer.from(JSON.stringify(user), "utf-8").toString("base64url")
  const sig = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}
