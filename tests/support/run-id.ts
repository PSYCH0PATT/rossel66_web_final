import { randomBytes } from "crypto"

/** Unique tag for this test/E2E run (safe for titles and emails). */
export function makeRunId(prefix = "e2e"): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const rnd = randomBytes(3).toString("hex")
  return `${prefix}-${stamp}-${rnd}`
}

export function syntheticEmail(runId: string, kind: string) {
  return `test+${kind}.${runId}@rossel.invalid`
}

export async function pollUntil<T>(
  fn: () => Promise<T | null | undefined | false>,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const intervalMs = opts.intervalMs ?? 500
  const started = Date.now()
  let last: T | null | undefined | false = null
  while (Date.now() - started < timeoutMs) {
    last = await fn()
    if (last) return last
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(
    `pollUntil timeout${opts.label ? ` (${opts.label})` : ""} after ${timeoutMs}ms; last=${JSON.stringify(last)}`
  )
}
