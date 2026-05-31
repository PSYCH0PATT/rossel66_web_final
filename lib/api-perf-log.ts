/**
 * Dev-only timing / payload logging for heavy dashboard API routes.
 */

const TRACKED_PREFIXES = [
  "/api/releases",
  "/api/analytics/streams",
  "/api/playlists/sftp",
] as const

export function shouldLogApiPerf(pathname: string): boolean {
  if (process.env.NODE_ENV === "production" && process.env.API_PERF_LOG !== "1") {
    return false
  }
  return TRACKED_PREFIXES.some((p) => pathname.startsWith(p))
}

export function logApiPerf(
  pathname: string,
  startedAt: number,
  body: string | Uint8Array | null,
  status = 200
): void {
  if (!shouldLogApiPerf(pathname)) return
  const ms = Math.round(performance.now() - startedAt)
  const bytes =
    body === null
      ? 0
      : typeof body === "string"
        ? new TextEncoder().encode(body).byteLength
        : body.byteLength
  console.info(`[api-perf] ${status} ${pathname} ${ms}ms ~${bytes}B`)
}

export async function jsonWithPerfLog(
  pathname: string,
  startedAt: number,
  payload: unknown,
  init?: ResponseInit
): Promise<Response> {
  const body = JSON.stringify(payload)
  logApiPerf(pathname, startedAt, body, init?.status ?? 200)
  return new Response(body, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}
