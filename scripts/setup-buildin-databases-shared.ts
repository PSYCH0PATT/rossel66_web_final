/**
 * Recreate Buildin databases under the shared team hub page
 * (not personal/workspace root of the integration bot).
 *
 * Default parent: ROSSEL 66 — Командный хаб
 *   BUILDIN_PARENT_PAGE_ID=1a844652-0f7a-437f-b630-7ebb67eb2fd4
 *
 * Usage:
 *   npx tsx scripts/setup-buildin-databases-shared.ts
 *   npx tsx scripts/setup-buildin-databases-shared.ts --force
 */
import { readFileSync, existsSync, writeFileSync } from "fs"
import { resolve } from "path"
import {
  BUILDIN_DATABASE_DEFS,
  propertiesWithoutRelations,
  type BuildinDatabaseDefKey,
} from "../lib/buildin/database-defs"
import { buildinCreateDatabase, buildinGetMe, buildinFetch } from "../lib/buildin/client"
import { getBuildinApiToken, BUILDIN_DB_ENV_NAMES } from "../lib/buildin/env"

const HUB_PAGE_ID =
  process.env.BUILDIN_PARENT_PAGE_ID?.trim() ||
  "1a844652-0f7a-437f-b630-7ebb67eb2fd4"

const ENV_NAMES = BUILDIN_DB_ENV_NAMES

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

function upsertEnvKeys(filePath: string, pairs: Record<string, string>) {
  let text = existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
  for (const [key, value] of Object.entries(pairs)) {
    const re = new RegExp(`^${key}=.*$`, "m")
    if (re.test(text)) {
      text = text.replace(re, `${key}=${value}`)
    } else {
      text = text.replace(/\s*$/, `\n${key}=${value}\n`)
    }
  }
  writeFileSync(filePath, text)
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(2)
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} @ ${me.workspace_name}`)
  console.log(`Parent (shared hub): ${HUB_PAGE_ID}`)

  // Verify bot can see the hub
  try {
    const hub = await buildinFetch<{ id: string; url?: string }>(
      `/v2/pages/${HUB_PAGE_ID}`
    )
    console.log(`Hub OK: ${hub.url || hub.id}`)
  } catch (err) {
    console.error(
      "Cannot access shared hub page. Invite the integration to «ROSSEL 66 — Командный хаб» first.",
      err instanceof Error ? err.message : err
    )
    process.exit(1)
  }

  const results: Record<string, string> = {}

  for (const key of Object.keys(BUILDIN_DATABASE_DEFS) as BuildinDatabaseDefKey[]) {
    const def = BUILDIN_DATABASE_DEFS[key]
    const envName = ENV_NAMES[key]
    console.log(`creating ${key} under hub...`)
    const db = await buildinCreateDatabase({
      parent: { page_id: HUB_PAGE_ID },
      title: def.title,
      icon: def.icon,
      properties: propertiesWithoutRelations(
        def.properties as Record<string, { type: string }>
      ),
    })
    console.log(`  → ${envName}=${db.id}`)
    results[envName] = db.id
  }

  const envLocal = resolve(process.cwd(), ".env.local")
  upsertEnvKeys(envLocal, {
    BUILDIN_PARENT_PAGE_ID: HUB_PAGE_ID,
    ...results,
  })

  const docsPath = resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env")
  writeFileSync(
    docsPath,
    [
      "# Buildin database IDs under shared hub (ROSSEL 66 — Командный хаб)",
      `# BUILDIN_PARENT_PAGE_ID=${HUB_PAGE_ID}`,
      "# Copy BUILDIN_DB_* into .env.local + Timeweb. Restrict PII ACL.",
      "",
      "BUILDIN_API_BASE_URL=https://api.buildin.ai",
      "BUILDIN_DUAL_WRITE=true",
      "PYRUS_WRITE_DISABLED=false",
      `BUILDIN_PARENT_PAGE_ID=${HUB_PAGE_ID}`,
      "",
      ...Object.entries(results).map(([k, v]) => `${k}=${v}`),
      "",
    ].join("\n")
  )

  console.log("\nUpdated .env.local and docs/BUILDIN_DATABASE_IDS.env")
  console.log("Old personal-root databases can be deleted in Buildin UI.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
