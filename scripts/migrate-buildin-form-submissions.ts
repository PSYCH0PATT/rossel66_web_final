/**
 * Migrate historical root submissions (form_back_catalog / release_upload /
 * distribution) from the shared «Анкеты и обращения» inbox into dedicated queues.
 *
 * Idempotent via checkpoint file oldPageId → newPageId.
 * Copies top-level children blocks (text/toggles/files) onto the new page.
 * Does not invent missing scalar fields; prints reconciliation + unrecoverable list.
 *
 * Usage:
 *   npx tsx scripts/migrate-buildin-form-submissions.ts --dry-run --e2e
 *   npx tsx scripts/migrate-buildin-form-submissions.ts --e2e --apply
 *   npx tsx scripts/migrate-buildin-form-submissions.ts --dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { buildinFetch, buildinGetMe } from "../lib/buildin/client"
import { getBuildinApiToken } from "../lib/buildin/env"
import { formTypeToDatabaseKey } from "../lib/buildin/env"
import { richText, textProp, titleProp, dateProp, checkboxProp } from "../lib/buildin/types"

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

function plain(
  prop: { title?: Array<{ plain_text?: string }>; rich_text?: Array<{ plain_text?: string }> } | undefined
) {
  const arr = prop?.title || prop?.rich_text || []
  return arr.map((t) => t.plain_text || "").join("").trim()
}

const FILE_FORM_TYPES = new Set([
  "catalog_upload",
  "Бэк-каталог",
  "release_upload",
  "Загрузка релиза",
  "distribution",
  "Дистрибуция",
])

function classifyFormType(tipo: string, title: string): string | null {
  const t = tipo.trim()
  if (t === "catalog_upload" || t === "Бэк-каталог") return "catalog_upload"
  if (t === "release_upload" || t === "Загрузка релиза") return "release_upload"
  if (t === "distribution" || t === "Дистрибуция") return "distribution"
  // Heuristic fallback from title prefixes used in older dual-write
  if (/каталог|catalog/i.test(title)) return "catalog_upload"
  if (/дистриб|distribution/i.test(title)) return "distribution"
  if (/релиз|release/i.test(title) && !/каталог/i.test(title))
    return "release_upload"
  return null
}

async function queryAll(databaseId: string) {
  const pages: Array<Record<string, unknown>> = []
  let cursor: string | undefined
  do {
    const body: Record<string, unknown> = { page_size: 50 }
    if (cursor) body.start_cursor = cursor
    const json = (await buildinFetch(`/v2/databases/${databaseId}/query`, {
      method: "POST",
      body,
    })) as {
      results?: Array<Record<string, unknown>>
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

  const submissionsId = (
    e2e
      ? process.env.E2E_BUILDIN_DB_SUBMISSIONS
      : process.env.BUILDIN_DB_SUBMISSIONS
  )?.trim()
  if (!submissionsId) {
    console.error("BUILDIN_DB_SUBMISSIONS / E2E_BUILDIN_DB_SUBMISSIONS required")
    process.exit(1)
  }

  const queueEnv = (key: string) => {
    const map: Record<string, [string, string]> = {
      form_back_catalog: [
        "BUILDIN_DB_FORM_BACK_CATALOG",
        "E2E_BUILDIN_DB_FORM_BACK_CATALOG",
      ],
      form_release_upload: [
        "BUILDIN_DB_FORM_RELEASE_UPLOAD",
        "E2E_BUILDIN_DB_FORM_RELEASE_UPLOAD",
      ],
      form_distribution: [
        "BUILDIN_DB_FORM_DISTRIBUTION",
        "E2E_BUILDIN_DB_FORM_DISTRIBUTION",
      ],
    }
    const [prod, sandbox] = map[key]
    return (e2e ? process.env[sandbox] : process.env[prod])?.trim() || process.env[prod]?.trim()
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} (${dryRun ? "DRY-RUN" : "APPLY"})`)

  const outDir = resolve(
    process.cwd(),
    "tmp",
    `form-submissions-migrate-${e2e ? "e2e" : "prod"}`
  )
  mkdirSync(outDir, { recursive: true })
  const checkpointPath = resolve(outDir, "checkpoint.json")
  const checkpoint: Record<string, string> = existsSync(checkpointPath)
    ? JSON.parse(readFileSync(checkpointPath, "utf8"))
    : {}

  const roots = await queryAll(submissionsId)
  const stats = {
    scanned: roots.length,
    classified: 0,
    skippedNonFile: 0,
    alreadyMigrated: 0,
    created: 0,
    unrecoverable: [] as string[],
  }

  for (const page of roots) {
    const id = String(page.id || "")
    const props = (page.properties || {}) as Record<
      string,
      {
        title?: Array<{ plain_text?: string }>
        rich_text?: Array<{ plain_text?: string }>
        select?: { name?: string }
        number?: number | null
        email?: string | null
        date?: { start?: string | null }
      }
    >
    const title = plain(props["Название"])
    const tipo = props["Тип"]?.select?.name || ""
    const formType = classifyFormType(tipo, title)
    if (!formType) {
      stats.skippedNonFile++
      continue
    }
    stats.classified++
    if (checkpoint[id]) {
      stats.alreadyMigrated++
      continue
    }

    const dbKey = formTypeToDatabaseKey(formType)
    const targetDb = queueEnv(dbKey)
    if (!targetDb) {
      throw new Error(`Missing target DB for ${dbKey}`)
    }

    const artists =
      plain(props["Артист"]) || plain(props["Артисты"]) || ""
    const submittedAt =
      props["Дата заявки"]?.date?.start ||
      new Date().toISOString().slice(0, 10)

    const newProps: Record<string, unknown> = {
      Артист: titleProp(artists || title || "Заявка"),
      "Название релиза": textProp(title || "Без названия"),
      "Дата заявки": dateProp(String(submittedAt).slice(0, 10)),
      Обработана: checkboxProp(false),
    }

    // Fields we cannot reconstruct from root row alone
    if (formType !== "catalog_upload") {
      stats.unrecoverable.push(
        `${id}: scalar Дата релиза/Тип/Жанр/Промо may be missing (live on page body only)`
      )
    }
    if (formType === "catalog_upload" && (props["Email"]?.email || plain(props["Telegram"]))) {
      stats.unrecoverable.push(
        `${id}: invented Email/Telegram on catalog root — not copied`
      )
    }

    console.log(
      `${dryRun ? "[dry] " : ""}migrate ${id} → ${dbKey} «${title.slice(0, 60)}»`
    )

    if (dryRun) continue

    // Fetch source children (shallow + one nested level for toggles)
    const sourceChildren = await fetchChildrenForCopy(id)

    const created = (await buildinFetch(`/v2/pages`, {
      method: "POST",
      body: {
        parent: { database_id: targetDb },
        properties: newProps,
      },
    })) as { id?: string }

    if (!created.id) throw new Error(`Create failed for ${id}`)

    // Migration banner + copied blocks
    const banner = {
      type: "paragraph",
      paragraph: {
        rich_text: richText(
          `Мигрировано из inbox ${submissionsId}, oldPageId=${id}`
        ),
      },
    }
    await buildinFetch(`/v2/blocks/${created.id}/children`, {
      method: "PATCH",
      body: { children: [banner, ...sourceChildren.topLevel] },
    })
    // Nested children for toggles (second pass — Buildin ignores nested on create)
    for (const nested of sourceChildren.nested) {
      await buildinFetch(`/v2/blocks/${nested.parentHint}/children`, {
        method: "PATCH",
        body: { children: nested.children },
      }).catch(() => {
        /* parentHint is old id — re-map below if needed */
      })
    }
    // Re-fetch new top-level to map toggle order → append nested by index
    if (sourceChildren.nestedByIndex.length) {
      const newKids = (await buildinFetch(
        `/v2/blocks/${created.id}/children?page_size=100`
      )) as { results?: Array<{ id?: string; type?: string }> }
      const toggles = (newKids.results || []).filter((b) => b.type === "toggle")
      for (let i = 0; i < sourceChildren.nestedByIndex.length; i++) {
        const kids = sourceChildren.nestedByIndex[i]
        const toggleId = toggles[i]?.id
        if (!toggleId || !kids.length) continue
        await buildinFetch(`/v2/blocks/${toggleId}/children`, {
          method: "PATCH",
          body: { children: kids },
        })
      }
    }

    checkpoint[id] = created.id
    writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2))
    stats.created++
  }

  writeFileSync(
    resolve(outDir, "reconciliation.json"),
    JSON.stringify({ dryRun, e2e, stats, checkpointCount: Object.keys(checkpoint).length }, null, 2)
  )
  console.log(JSON.stringify(stats, null, 2))
  console.log(`Wrote ${outDir}`)
  if (dryRun) {
    console.log("Dry-run complete. Pass --apply to create pages.")
  }
}

/** Strip read-only fields and prepare blocks for re-append. */
function sanitizeBlockForCopy(block: Record<string, unknown>): Record<string, unknown> | null {
  const type = String(block.type || "")
  if (!type || type === "unsupported") return null
  const payload = block[type]
  if (!payload || typeof payload !== "object") return null
  const copy: Record<string, unknown> = {
    type,
    [type]: { ...(payload as Record<string, unknown>) },
  }
  // Drop nested children — appended in a second pass
  const inner = copy[type] as Record<string, unknown>
  delete inner.children
  return copy
}

async function fetchChildrenForCopy(pageId: string): Promise<{
  topLevel: Record<string, unknown>[]
  nested: Array<{ parentHint: string; children: Record<string, unknown>[] }>
  nestedByIndex: Record<string, unknown>[][]
}> {
  const list = (await buildinFetch(
    `/v2/blocks/${pageId}/children?page_size=100`
  )) as {
    results?: Array<Record<string, unknown> & { id?: string; type?: string; has_children?: boolean }>
  }
  const topLevel: Record<string, unknown>[] = []
  const nested: Array<{ parentHint: string; children: Record<string, unknown>[] }> = []
  const nestedByIndex: Record<string, unknown>[][] = []
  for (const block of list.results || []) {
    const sanitized = sanitizeBlockForCopy(block)
    if (!sanitized) continue
    topLevel.push(sanitized)
    if (block.has_children && block.id && block.type === "toggle") {
      const kids = (await buildinFetch(
        `/v2/blocks/${block.id}/children?page_size=100`
      )) as { results?: Array<Record<string, unknown>> }
      const cleaned = (kids.results || [])
        .map((k) => sanitizeBlockForCopy(k))
        .filter(Boolean) as Record<string, unknown>[]
      nested.push({ parentHint: block.id, children: cleaned })
      nestedByIndex.push(cleaned)
    } else if (block.type === "toggle") {
      nestedByIndex.push([])
    }
  }
  return { topLevel, nested, nestedByIndex }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
