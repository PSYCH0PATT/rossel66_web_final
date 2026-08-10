/**
 * Create the three form-queue databases (back catalog / release upload / distribution)
 * under the shared hub (production) or E2E parent.
 *
 * Does NOT create CRM releases/tracks — those stay Supabase mirrors.
 * Marks archived child DBs by renaming titles when IDs are present.
 *
 * Usage:
 *   BUILDIN_API_TOKEN=… npx tsx scripts/setup-buildin-form-queues.ts
 *   BUILDIN_API_TOKEN=… npx tsx scripts/setup-buildin-form-queues.ts --e2e
 *   BUILDIN_API_TOKEN=… npx tsx scripts/setup-buildin-form-queues.ts --archive-children
 */
import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import {
  BUILDIN_DATABASE_DEFS,
  propertiesWithoutRelations,
  type BuildinDatabaseDefKey,
} from "../lib/buildin/database-defs"
import {
  buildinCreateDatabase,
  buildinFetch,
  buildinGetMe,
} from "../lib/buildin/client"
import {
  BUILDIN_DB_ENV_NAMES,
  getBuildinApiToken,
  getBuildinDatabaseId,
} from "../lib/buildin/env"
import { richText } from "../lib/buildin/types"

const QUEUE_KEYS: BuildinDatabaseDefKey[] = [
  "form_back_catalog",
  "form_release_upload",
  "form_distribution",
]

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
    if (re.test(text)) text = text.replace(re, `${key}=${value}`)
    else text = text.replace(/\s*$/, `\n${key}=${value}\n`)
  }
  writeFileSync(filePath, text)
}

async function archiveChildDb(databaseId: string, title: string) {
  // Database title lives on the database object
  await buildinFetch(`/v2/databases/${databaseId}`, {
    method: "PATCH",
    body: {
      title: richText(title),
    },
  })
}

async function main() {
  const e2e = process.argv.includes("--e2e")
  const archiveChildren = process.argv.includes("--archive-children")

  loadEnvFile(resolve(process.cwd(), ".env.local"))
  if (e2e) loadEnvFile(resolve(process.cwd(), ".env.e2e.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(2)
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} @ ${me.workspace_name}`)

  const parentId = e2e
    ? process.env.BUILDIN_E2E_PARENT_PAGE_ID?.trim() ||
      process.env.E2E_BUILDIN_E2E_PARENT_PAGE_ID?.trim()
    : process.env.BUILDIN_PARENT_PAGE_ID?.trim() ||
      "1a844652-0f7a-437f-b630-7ebb67eb2fd4"

  if (!parentId) {
    console.error("Parent page id missing (BUILDIN_PARENT_PAGE_ID / E2E parent)")
    process.exit(1)
  }

  const results: Record<string, string> = {}

  for (const key of QUEUE_KEYS) {
    const envName = BUILDIN_DB_ENV_NAMES[key]
    const e2eEnv = `E2E_${envName}`
    const existing = e2e
      ? process.env[e2eEnv]?.trim() || process.env[envName]?.trim()
      : getBuildinDatabaseId(key)

    if (existing) {
      console.log(`skip ${key}: ${e2e ? e2eEnv : envName}=${existing}`)
      results[e2e ? e2eEnv : envName] = existing
      continue
    }

    const def = BUILDIN_DATABASE_DEFS[key]
    console.log(`creating ${key}…`)
    const title = e2e
      ? richText(
          `E2E — ${
            def.title.map((t) => t.plain_text || "").join("").replace(/^ROSSEL — /, "")
          }`
        )
      : def.title

    const db = await buildinCreateDatabase({
      parent: { page_id: parentId },
      title,
      icon: def.icon,
      properties: propertiesWithoutRelations(
        def.properties as Record<string, { type: string }>
      ),
    })
    console.log(`  → ${e2e ? e2eEnv : envName}=${db.id}`)
    results[e2e ? e2eEnv : envName] = db.id
  }

  if (archiveChildren) {
    for (const key of ["submission_releases", "submission_tracks"] as const) {
      const id = getBuildinDatabaseId(key)
      if (!id) continue
      const title =
        key === "submission_releases"
          ? "ROSSEL — Релизы заявок (архив)"
          : "ROSSEL — Треки заявок (архив)"
      console.log(`archiving ${key} (${id})…`)
      try {
        await archiveChildDb(id, title)
      } catch (err) {
        console.warn(`archive ${key}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  if (Object.keys(results).length) {
    if (e2e) {
      upsertEnvKeys(resolve(process.cwd(), ".env.e2e.local"), results)
      const docsPath = resolve(process.cwd(), "docs/FORMS_E2E_DATABASE_IDS.env")
      upsertEnvKeys(docsPath, results)
      console.log("Updated .env.e2e.local and docs/FORMS_E2E_DATABASE_IDS.env")
    } else {
      upsertEnvKeys(resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env"), results)
      console.log("Updated docs/BUILDIN_DATABASE_IDS.env — copy into .env.local / Vercel")
    }
  }

  console.log("\n# Env lines:\n")
  for (const [k, v] of Object.entries(results)) console.log(`${k}=${v}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
