/**
 * Cleanup E2E leftovers older than TTL.
 *
 * - Deletes FormDeliverySession rows past expiresAt (via cleanupExpiredFormSessions)
 * - Optionally trashes Buildin pages whose title contains E2E_RUN_ID / e2e- prefix
 *   when BUILDIN_API_TOKEN + BUILDIN_DB_SUBMISSIONS point at the sandbox.
 *
 * Usage:
 *   npx tsx scripts/cleanup-e2e-artifacts.ts
 *   E2E_TITLE_PREFIX=e2e- npx tsx scripts/cleanup-e2e-artifacts.ts
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let value = t.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.e2e.local"))
  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))

  // Prefer E2E DB mapping if present
  for (const [from, to] of [
    ["E2E_BUILDIN_DB_SUBMISSIONS", "BUILDIN_DB_SUBMISSIONS"],
    ["E2E_BUILDIN_DB_SUBMISSION_RELEASES", "BUILDIN_DB_SUBMISSION_RELEASES"],
    ["E2E_BUILDIN_DB_SUBMISSION_TRACKS", "BUILDIN_DB_SUBMISSION_TRACKS"],
  ] as const) {
    if (process.env[from] && !process.env[to]) {
      process.env[to] = process.env[from]
    }
  }

  const { cleanupExpiredFormSessions } = await import(
    "../lib/buildin/form-session"
  )
  const { prisma } = await import("../lib/prisma")
  const n = await cleanupExpiredFormSessions()
  console.log(`Expired delivery sessions deleted: ${n}`)

  // Rate buckets older than 1 day
  const buckets = await prisma.formRateBucket.deleteMany({
    where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })
  console.log(`Stale rate buckets deleted: ${buckets.count}`)

  const prefix = process.env.E2E_TITLE_PREFIX?.trim() || "E2E "
  const maxAgeHours = Number(process.env.E2E_CLEANUP_MAX_AGE_HOURS || 24)
  const cutoff = Date.now() - maxAgeHours * 3600_000

  const { getBuildinApiToken, getBuildinDatabaseId } = await import(
    "../lib/buildin/env"
  )
  const { buildinFetch, buildinUpdatePage } = await import(
    "../lib/buildin/client"
  )

  if (!getBuildinApiToken() || !getBuildinDatabaseId("submissions")) {
    console.log("Skip Buildin page trash (token/DB missing)")
    return
  }

  const dbId = getBuildinDatabaseId("submissions")!
  let cursor: string | undefined
  let trashed = 0
  for (let page = 0; page < 20; page++) {
    const body: Record<string, unknown> = {
      page_size: 50,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    }
    if (cursor) body.start_cursor = cursor
    const res = await buildinFetch<{
      results: Array<{
        id: string
        created_time?: string
        properties?: Record<
          string,
          { title?: Array<{ plain_text?: string }> }
        >
      }>
      next_cursor?: string | null
      has_more?: boolean
    }>(`/v2/databases/${dbId}/query`, { method: "POST", body })

    for (const row of res.results || []) {
      const title =
        row.properties?.["Название"]?.title
          ?.map((t) => t.plain_text || "")
          .join("") || ""
      if (!title.includes(prefix) && !/e2e-/i.test(title)) continue
      const created = row.created_time
        ? Date.parse(row.created_time)
        : Date.now()
      if (created > cutoff) continue
      await buildinUpdatePage(row.id, { in_trash: true })
      trashed++
    }
    if (!res.has_more || !res.next_cursor) break
    cursor = res.next_cursor
  }
  console.log(`Buildin E2E pages trashed: ${trashed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
