/**
 * Smoke-check Buildin REST auth + submissions DB.
 *
 * Reads BUILDIN_API_TOKEN or BUILDIN_TOKEN from .env.local / .env / process.env.
 * Does NOT print the token.
 *
 *   npm run smoke:buildin
 *
 * Exit 0 = whoami + database get OK
 * Exit 2 = token missing (expected until you add the integration token)
 * Exit 1 = API/auth failure
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"))
loadEnvFile(resolve(process.cwd(), ".env"))

async function main() {
  const { getBuildinApiToken, getBuildinDatabaseId, getBuildinApiBaseUrl } =
    await import("../lib/buildin/env")
  const { buildinGetMe, buildinGetDatabase } = await import("../lib/buildin/client")

  const token = getBuildinApiToken()
  if (!token) {
    console.error(
      [
        "BUILDIN_API_TOKEN / BUILDIN_TOKEN is not set.",
        "",
        "MCP in Cursor is NOT enough for the Next.js server.",
        "Get a Bearer token:",
        "  1. Buildin → Settings → Integrations",
        "  2. Create «Rossel Music Production» (or open existing bot)",
        "  3. Copy API Token into .env.local as BUILDIN_API_TOKEN=...",
        "  4. Also set the same secret on Timeweb for production",
        "  5. Re-run: npm run smoke:buildin",
        "",
        "Do not paste the token into chat.",
      ].join("\n")
    )
    process.exit(2)
  }

  console.log(`Base URL: ${getBuildinApiBaseUrl()}`)
  console.log(`Token: present (len=${token.length})`)

  const me = await buildinGetMe()
  console.log(
    `whoami: ${me.name} @ ${me.workspace_name} (${me.workspace_id}) type=${me.object}`
  )

  const submissionsId = getBuildinDatabaseId("submissions")
  if (!submissionsId) {
    console.error("BUILDIN_DB_SUBMISSIONS missing — copy from docs/BUILDIN_DATABASE_IDS.env")
    process.exit(1)
  }

  const db = await buildinGetDatabase(submissionsId)
  const title =
    db.title?.map((t) => t.plain_text || "").join("") || "(no title)"
  console.log(`submissions DB: ${db.id} — ${title}`)

  const required: Array<Parameters<typeof getBuildinDatabaseId>[0]> = [
    "submissions",
    "artists",
    "releases",
    "tracks",
    "reports",
    "playlists",
    "automation_runs",
    "pii_rf",
    "pii_not_rf",
    "activity",
    "playlist_history",
  ]
  const missing = required.filter((k) => !getBuildinDatabaseId(k))
  if (missing.length) {
    console.error("Missing BUILDIN_DB_* keys:", missing.join(", "))
    process.exit(1)
  }
  console.log(`All ${required.length} BUILDIN_DB_* keys present.`)
  console.log("Smoke OK — dual-write can run when BUILDIN_DUAL_WRITE is not false.")
}

main().catch((err) => {
  console.error("Smoke failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
