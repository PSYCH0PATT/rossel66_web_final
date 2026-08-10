/**
 * Align live form-queue Buildin schemas with FORM_QUEUE_CONTRACTS.
 *
 * Safe by default (dry-run unless --apply):
 *  - snapshot current schemas + page counts
 *  - prevalidate ALL queues before any PATCH
 *  - add missing properties from BUILDIN_DATABASE_DEFS
 *  - rename title «Название» → «Артист» when needed
 *  - remove non-contract columns ONLY when empty on every page
 *  - never touches CRM releases/tracks or submissions inbox
 *
 * Usage:
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --dry-run --e2e
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --e2e --apply
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --e2e --apply --clear-forbidden-values
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --dry-run   # production IDs
 *   npx tsx scripts/migrate-buildin-form-queue-schemas.ts --apply     # production apply
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import {
  BUILDIN_DATABASE_DEFS,
  type BuildinDatabaseDefKey,
} from "../lib/buildin/database-defs"
import {
  FORM_QUEUE_CONTRACTS,
  type FileFormType,
} from "../lib/buildin/form-contracts"
import { buildinFetch, buildinGetMe } from "../lib/buildin/client"
import { BUILDIN_DB_ENV_NAMES, getBuildinApiToken } from "../lib/buildin/env"
import { emailProp, textProp, selectProp, dateProp, titleProp } from "../lib/buildin/types"

const QUEUE_KEYS: Array<{
  formType: FileFormType
  dbKey: BuildinDatabaseDefKey
  envName: string
  e2eEnvName: string
}> = [
  {
    formType: "catalog_upload",
    dbKey: "form_back_catalog",
    envName: BUILDIN_DB_ENV_NAMES.form_back_catalog,
    e2eEnvName: "E2E_BUILDIN_DB_FORM_BACK_CATALOG",
  },
  {
    formType: "release_upload",
    dbKey: "form_release_upload",
    envName: BUILDIN_DB_ENV_NAMES.form_release_upload,
    e2eEnvName: "E2E_BUILDIN_DB_FORM_RELEASE_UPLOAD",
  },
  {
    formType: "distribution",
    dbKey: "form_distribution",
    envName: BUILDIN_DB_ENV_NAMES.form_distribution,
    e2eEnvName: "E2E_BUILDIN_DB_FORM_DISTRIBUTION",
  },
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

type PropMeta = {
  id: string
  name: string
  type: string
}

function propValueEmpty(prop: Record<string, unknown> | undefined): boolean {
  if (!prop) return true
  const type = String(prop.type || "")
  if (type === "title") {
    const t = prop.title as Array<{ plain_text?: string }> | undefined
    return !t?.some((x) => (x.plain_text || "").trim())
  }
  if (type === "rich_text") {
    const t = prop.rich_text as Array<{ plain_text?: string }> | undefined
    return !t?.some((x) => (x.plain_text || "").trim())
  }
  if (type === "email") return !(prop.email as string | null)
  if (type === "number") return prop.number == null
  if (type === "select") return !(prop.select as { name?: string } | null)?.name
  if (type === "date") return !(prop.date as { start?: string } | null)?.start
  if (type === "url") return !(prop.url as string | null)
  if (type === "checkbox") return prop.checkbox !== true
  if (type === "people") return !((prop.people as unknown[]) || []).length
  if (type === "files") return !((prop.files as unknown[]) || []).length
  if (type === "relation") return !((prop.relation as unknown[]) || []).length
  return false
}

async function queryAllPages(databaseId: string) {
  const pages: Array<{
    id: string
    properties: Record<string, Record<string, unknown>>
  }> = []
  let cursor: string | undefined
  do {
    const body: Record<string, unknown> = { page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const json = (await buildinFetch(`/v2/databases/${databaseId}/query`, {
      method: "POST",
      body,
    })) as {
      results?: Array<{
        id: string
        properties: Record<string, Record<string, unknown>>
      }>
      next_cursor?: string | null
      has_more?: boolean
    }
    pages.push(...(json.results || []))
    cursor = json.has_more ? json.next_cursor || undefined : undefined
  } while (cursor)
  return pages
}

async function main() {
  const apply = process.argv.includes("--apply")
  const dryRun = !apply || process.argv.includes("--dry-run")
  const e2e = process.argv.includes("--e2e")
  const clearForbidden = process.argv.includes("--clear-forbidden-values")
  if (clearForbidden && !e2e) {
    console.error("--clear-forbidden-values only allowed with --e2e")
    process.exit(1)
  }
  if (apply && process.argv.includes("--dry-run")) {
    console.error("Pass either --apply or --dry-run, not both")
    process.exit(1)
  }

  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))
  loadEnvFile(resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env"))
  loadEnvFile(resolve(process.cwd(), "docs/FORMS_E2E_DATABASE_IDS.env"))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(1)
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} (${dryRun ? "DRY-RUN" : "APPLY"}${e2e ? ", e2e" : ", prod"})`)

  const outDir = resolve(
    process.cwd(),
    "tmp",
    `form-queue-schema-${e2e ? "e2e" : "prod"}-${Date.now()}`
  )
  mkdirSync(outDir, { recursive: true })

  const report: Record<string, unknown> = {
    dryRun,
    e2e,
    checkedAt: new Date().toISOString(),
    queues: {},
  }

  type PendingPatch = {
    dbKey: string
    databaseId: string
    patchProps: Record<string, unknown>
  }
  const pendingPatches: PendingPatch[] = []
  let blockedAnywhere = false

  for (const q of QUEUE_KEYS) {
    const databaseId =
      (e2e ? process.env[q.e2eEnvName] : process.env[q.envName])?.trim() ||
      process.env[q.envName]?.trim()
    if (!databaseId) {
      throw new Error(`Missing database id for ${q.dbKey} (${q.envName})`)
    }

    const contract = FORM_QUEUE_CONTRACTS[q.formType]
    const desired = BUILDIN_DATABASE_DEFS[q.dbKey].properties as Record<
      string,
      { name: string; type: string; [k: string]: unknown }
    >
    const desiredNames = new Set(
      Object.values(desired).map((s) => s.name || "")
    )

    const db = (await buildinFetch(`/v2/databases/${databaseId}`)) as {
      id: string
      title?: Array<{ plain_text?: string }>
      properties: Record<string, PropMeta & Record<string, unknown>>
    }
    const pages = await queryAllPages(databaseId)
    writeFileSync(
      resolve(outDir, `${q.dbKey}-schema.json`),
      JSON.stringify(db, null, 2)
    )
    writeFileSync(
      resolve(outDir, `${q.dbKey}-page-count.json`),
      JSON.stringify({ count: pages.length }, null, 2)
    )

    const byName = new Map<string, PropMeta>()
    for (const p of Object.values(db.properties || {})) {
      byName.set(p.name, { id: p.id, name: p.name, type: p.type })
    }

    const toAdd: Record<string, unknown> = {}
    for (const [key, schema] of Object.entries(desired)) {
      if (!byName.has(schema.name || key)) {
        const { name: _n, ...rest } = schema as { name?: string } & Record<
          string,
          unknown
        >
        toAdd[key] = { name: schema.name || key, ...rest }
      }
    }

    // Title: «Название» → «Артист»
    const renameOps: Array<{
      from: string
      to: string
      id: string
      type: string
    }> = []
    {
      const oldTitle = byName.get("Название")
      const newTitle = byName.get("Артист")
      if (oldTitle?.type === "title" && !newTitle) {
        renameOps.push({
          from: "Название",
          to: "Артист",
          id: oldTitle.id,
          type: "title",
        })
        delete toAdd["Артист"]
      }
    }

    // Any live column not in the 4-column contract is removable when empty
    const removable: Array<{ name: string; id: string; empty: boolean; type: string }> =
      []
    for (const meta of byName.values()) {
      if (desiredNames.has(meta.name)) continue
      if (renameOps.some((r) => r.from === meta.name)) continue
      let empty = true
      for (const page of pages) {
        if (!propValueEmpty(page.properties?.[meta.name])) {
          empty = false
          break
        }
      }
      removable.push({
        name: meta.name,
        id: meta.id,
        empty,
        type: meta.type,
      })
    }

    // Also treat contract.forbiddenColumns that still exist
    for (const bad of contract.forbiddenColumns) {
      if (removable.some((r) => r.name === bad)) continue
      const meta = byName.get(bad)
      if (!meta) continue
      if (renameOps.some((r) => r.from === bad)) continue
      if (desiredNames.has(bad)) continue
      let empty = true
      for (const page of pages) {
        if (!propValueEmpty(page.properties?.[meta.name])) {
          empty = false
          break
        }
      }
      removable.push({
        name: bad,
        id: meta.id,
        empty,
        type: meta.type,
      })
    }

    if (clearForbidden && !dryRun) {
      const toClear = removable.filter((r) => !r.empty)
      for (const r of toClear) {
        for (const page of pages) {
          if (propValueEmpty(page.properties?.[r.name])) continue
          const clearBody: Record<string, unknown> = {}
          const type = String(page.properties?.[r.name]?.type || r.type || "")
          if (type === "title") clearBody[r.name] = titleProp("")
          else if (type === "email") clearBody[r.name] = emailProp(null)
          else if (type === "rich_text") clearBody[r.name] = textProp("")
          else if (type === "number")
            clearBody[r.name] = { type: "number", number: null }
          else if (type === "select") clearBody[r.name] = selectProp(null)
          else if (type === "date") clearBody[r.name] = dateProp(null)
          else if (type === "checkbox")
            clearBody[r.name] = { type: "checkbox", checkbox: false }
          else continue
          await buildinFetch(`/v2/pages/${page.id}`, {
            method: "PATCH",
            body: { properties: clearBody },
          })
        }
        r.empty = true
        console.log(`  cleared values for «${r.name}» on e2e pages`)
      }
    }

    const queueReport = {
      databaseId,
      pageCount: pages.length,
      toAdd: Object.keys(toAdd),
      renameOps,
      removable,
      blockedRemovals: removable.filter((r) => !r.empty).map((r) => r.name),
    }
    ;(report.queues as Record<string, unknown>)[q.dbKey] = queueReport

    console.log(`\n=== ${q.dbKey} (${databaseId}) pages=${pages.length} ===`)
    console.log(`  add: ${Object.keys(toAdd).join(", ") || "(none)"}`)
    console.log(
      `  rename: ${renameOps.map((r) => `${r.from}→${r.to}`).join(", ") || "(none)"}`
    )
    console.log(
      `  remove empty: ${removable
        .filter((r) => r.empty)
        .map((r) => r.name)
        .join(", ") || "(none)"}`
    )
    if (queueReport.blockedRemovals.length) {
      blockedAnywhere = true
      console.log(
        `  BLOCKED remove (has values): ${queueReport.blockedRemovals.join(", ")}`
      )
      const exportRows = pages
        .map((p) => {
          const row: Record<string, unknown> = { pageId: p.id }
          for (const name of queueReport.blockedRemovals) {
            row[name] = p.properties?.[name]
          }
          return row
        })
        .filter((r) =>
          queueReport.blockedRemovals.some(
            (n) => !propValueEmpty(r[n] as Record<string, unknown>)
          )
        )
      writeFileSync(
        resolve(outDir, `${q.dbKey}-nonempty-forbidden.json`),
        JSON.stringify(exportRows, null, 2)
      )
    }

    const patchProps: Record<string, unknown> = { ...toAdd }
    for (const r of renameOps) {
      if (r.type === "title") {
        patchProps[r.to] = {
          id: r.id,
          name: r.to,
          type: "title",
          title: {},
        }
      } else {
        patchProps[r.to] = {
          id: r.id,
          name: r.to,
          type: r.type,
          rich_text: {},
        }
      }
    }
    for (const r of removable) {
      if (!r.empty) continue
      patchProps[r.name] = null
    }
    if (Object.keys(patchProps).length > 0) {
      pendingPatches.push({ dbKey: q.dbKey, databaseId, patchProps })
    }
  }

  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2))
  console.log(`\nSnapshot/report written to ${outDir}`)

  if (blockedAnywhere) {
    console.error(
      "Prevalidation failed: blocked removals on one or more queues — no schema PATCH applied"
    )
    process.exit(2)
  }

  if (dryRun) {
    console.log(
      `Dry-run complete (${pendingPatches.length} queue(s) would be patched). Pass --apply to mutate.`
    )
    return
  }

  for (const patch of pendingPatches) {
    await buildinFetch(`/v2/databases/${patch.databaseId}`, {
      method: "PATCH",
      body: { properties: patch.patchProps },
    })
    console.log(`  schema patched: ${patch.dbKey}`)
  }
  console.log(`Applied ${pendingPatches.length} schema patch(es).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
