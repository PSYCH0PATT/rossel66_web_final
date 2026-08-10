/**
 * Create Buildin databases from BUILDIN_DATABASE_DEFS and print env lines.
 *
 * Usage:
 *   BUILDIN_API_TOKEN=... npx tsx scripts/setup-buildin-databases.ts
 *   BUILDIN_API_TOKEN=... npx tsx scripts/setup-buildin-databases.ts --dry-run
 */
import {
  BUILDIN_DATABASE_DEFS,
  propertiesWithoutRelations,
  type BuildinDatabaseDefKey,
} from "../lib/buildin/database-defs"
import { buildinCreateDatabase, buildinGetMe } from "../lib/buildin/client"
import { getBuildinApiToken, getBuildinDatabaseId, BUILDIN_DB_ENV_NAMES } from "../lib/buildin/env"

const ENV_NAMES = BUILDIN_DB_ENV_NAMES

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN is required")
    process.exit(1)
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} @ ${me.workspace_name} (${me.workspace_id})`)
  console.log(
    "ACL reminder: restrict PII databases (pii_rf / pii_not_rf) to a closed group before production use.\n"
  )

  const results: Array<{ key: string; env: string; id: string | null; skipped?: boolean }> = []

  for (const key of Object.keys(BUILDIN_DATABASE_DEFS) as BuildinDatabaseDefKey[]) {
    const envName = ENV_NAMES[key]
    const existing = getBuildinDatabaseId(key)
    if (existing) {
      console.log(`skip ${key}: already set ${envName}=${existing}`)
      results.push({ key, env: envName, id: existing, skipped: true })
      continue
    }

    const def = BUILDIN_DATABASE_DEFS[key]
    if (dryRun) {
      console.log(`[dry-run] would create ${key}`)
      results.push({ key, env: envName, id: null })
      continue
    }

    console.log(`creating ${key}...`)
    const db = await buildinCreateDatabase({
      title: def.title,
      icon: def.icon,
      properties: propertiesWithoutRelations(
        def.properties as Record<string, { type: string }>
      ),
    })
    console.log(`  → ${envName}=${db.id}`)
    results.push({ key, env: envName, id: db.id })
  }

  console.log("\n# Add to .env.local:\n")
  for (const r of results) {
    if (r.id) console.log(`${r.env}=${r.id}`)
  }
  console.log("\nBUILDIN_DUAL_WRITE=true")
  console.log("PYRUS_WRITE_DISABLED=false")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
