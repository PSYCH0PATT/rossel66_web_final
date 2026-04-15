import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export interface SessionUser {
  id: string
  username: string
  role: "admin" | "artist"
}

/**
 * Reads the current user from the httpOnly session cookie.
 * Returns null if not authenticated.
 */
export function getSessionUser(): SessionUser | null {
  try {
    const cookieStore = cookies()
    const raw = cookieStore.get("rossel_session")?.value
    if (!raw) return null
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"))
    if (!parsed?.id || !parsed?.role) return null
    return parsed as SessionUser
  } catch {
    return null
  }
}

/**
 * Returns a 401 response if the user is not authenticated.
 */
export async function requireAuth(_request?: Request): Promise<NextResponse | null> {
  const user = getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  return null
}

/**
 * Returns a 401/403 response if the user is not an admin.
 */
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

/**
 * Returns a 401/403 response if the user is not authenticated as `artistId` OR admin.
 */
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
 * Builds a base64-encoded session payload for the httpOnly cookie.
 */
export function buildSessionCookieValue(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64")
}
