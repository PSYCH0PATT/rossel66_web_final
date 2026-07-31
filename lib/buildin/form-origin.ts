import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * Origin / CSRF check for browser form APIs.
 * Allows same-origin and configured FORM_ALLOWED_ORIGINS.
 */
export function assertFormRequestOrigin(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  // Non-browser / same-site server tools may omit Origin
  if (!origin && !referer) return null

  const allowed = new Set<string>()
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const vercel = process.env.VERCEL_URL?.trim()
  if (site) {
    try {
      allowed.add(new URL(site).origin)
    } catch {
      /* ignore */
    }
  }
  if (vercel) allowed.add(`https://${vercel}`)
  for (const o of (process.env.FORM_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    allowed.add(o)
  }
  // Always allow request host
  try {
    const host = request.headers.get("host")
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || "https"
      allowed.add(`${proto}://${host}`)
      allowed.add(`http://${host}`)
      allowed.add(`https://${host}`)
    }
  } catch {
    /* ignore */
  }

  const candidate = origin || (referer ? new URL(referer).origin : "")
  if (!candidate) return null
  if (allowed.size === 0) return null
  if ([...allowed].some((a) => a === candidate)) return null

  return NextResponse.json(
    { message: "Forbidden origin", code: "bad_origin" },
    { status: 403 }
  )
}
