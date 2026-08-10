/**
 * Rename English CRM mirror property keys → Russian (OpenSpec 7.3).
 *
 * Targets prod artists / releases / tracks / reports only.
 * Never touches form_* queues, submissions, PII, playlists, or automation.
 *
 * Dry-run by default; pass --apply to PATCH live schemas.
 *
 * Usage:
 *   npx tsx scripts/migrate-buildin-crm-ru-labels.ts
 *   npx tsx scripts/migrate-buildin-crm-ru-labels.ts --apply
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { resolve } from "path"
import { buildinFetch, buildinGetMe } from "../lib/buildin/client"
import { BUILDIN_DB_ENV_NAMES, getBuildinApiToken } from "../lib/buildin/env"
import type { BuildinDatabaseDefKey } from "../lib/buildin/database-defs"

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

/** English → Russian renames. Relation keys АртистRel / РелизRel are never listed. */
const RENAMES: Record<
  "artists" | "releases" | "tracks" | "reports",
  Array<{ from: string; to: string }>
> = {
  artists: [
    { from: "Username", to: "Юзернейм" },
    { from: "Verified", to: "Верифицирован" },
    { from: "Ops Status", to: "Операционный статус" },
    { from: "Assignee", to: "Ответственный" },
    { from: "Tags", to: "Теги" },
    { from: "Notes", to: "Заметки" },
    { from: "Deadline", to: "Дедлайн" },
    { from: "Local ID", to: "Локальный ID" },
    { from: "Sync Version", to: "Версия синхр." },
  ],
  releases: [
    { from: "Artist Name", to: "Имя артиста" },
    { from: "Release Date", to: "Дата релиза" },
    { from: "Type", to: "Тип" },
    { from: "Auto Status", to: "Авто-статус" },
    { from: "Ops Status", to: "Операционный статус" },
    { from: "Assignee", to: "Ответственный" },
    { from: "Deadline", to: "Дедлайн" },
    { from: "Notes", to: "Заметки" },
    { from: "Local ID", to: "Локальный ID" },
    { from: "Artist ID", to: "ID артиста" },
    { from: "Sync Version", to: "Версия синхр." },
  ],
  tracks: [
    { from: "Artists", to: "Артисты" },
    { from: "Language", to: "Язык" },
    { from: "Explicit", to: "Мат" },
    { from: "Focus", to: "Фокус" },
    { from: "Duration", to: "Длительность" },
    { from: "Local ID", to: "Локальный ID" },
    { from: "Release Local ID", to: "Локальный ID релиза" },
    { from: "Submission ID", to: "ID заявки" },
  ],
  reports: [
    { from: "Quarter", to: "Квартал" },
    { from: "Year", to: "Год" },
    { from: "Amount", to: "Сумма" },
    { from: "Plays", to: "Прослушивания" },
    { from: "Paid", to: "Оплачен" },
    { from: "Signed", to: "Подписан" },
    { from: "Acknowledged", to: "Подтверждён" },
    { from: "Registered", to: "Зарегистрирован" },
    { from: "Ops Status", to: "Операционный статус" },
    { from: "Assignee", to: "Ответственный" },
    { from: "Deadline", to: "Дедлайн" },
    { from: "Notes", to: "Заметки" },
    { from: "File URL", to: "URL файла" },
    { from: "Local ID", to: "Локальный ID" },
    { from: "Artist ID", to: "ID артиста" },
    { from: "Sync Version", to: "Версия синхр." },
  ],
}

const CRM_KEYS = Object.keys(RENAMES) as Array<keyof typeof RENAMES>

type PropMeta = {
  id: string
  name: string
  type: string
} & Record<string, unknown>

function typePayload(prop: PropMeta): Record<string, unknown> {
  const type = prop.type
  switch (type) {
    case "title":
      return { title: {} }
    case "rich_text":
      return { rich_text: {} }
    case "number":
      return { number: prop.number ?? {} }
    case "select":
      return {
        select: {
          options: ((prop.select as { options?: unknown[] } | undefined)
            ?.options || []) as unknown[],
        },
      }
    case "multi_select":
      return {
        multi_select: {
          options: ((prop.multi_select as { options?: unknown[] } | undefined)
            ?.options || []) as unknown[],
        },
      }
    case "date":
      return { date: {} }
    case "people":
      return { people: {} }
    case "files":
      return { files: {} }
    case "checkbox":
      return { checkbox: {} }
    case "url":
      return { url: {} }
    case "email":
      return { email: {} }
    case "phone_number":
      return { phone_number: {} }
    default:
      return { [type]: {} }
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const dryRun = !apply

  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))
  loadEnvFile(resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env"))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(1)
  }

  const me = await buildinGetMe()
  console.log(
    `Authenticated as ${me.name} (${dryRun ? "DRY-RUN" : "APPLY"}, prod CRM only)`
  )

  const outDir = resolve(
    process.cwd(),
    "tmp",
    `crm-ru-labels-prod-${Date.now()}`
  )
  mkdirSync(outDir, { recursive: true })

  const report: Record<string, unknown> = {
    dryRun,
    checkedAt: new Date().toISOString(),
    databases: {},
  }

  for (const dbKey of CRM_KEYS) {
    const envName = BUILDIN_DB_ENV_NAMES[dbKey as BuildinDatabaseDefKey]
    const databaseId = process.env[envName]?.trim()
    if (!databaseId) {
      throw new Error(`Missing database id for ${dbKey} (${envName})`)
    }

    const db = (await buildinFetch(`/v2/databases/${databaseId}`)) as {
      id: string
      title?: Array<{ plain_text?: string }>
      properties: Record<string, PropMeta>
    }

    writeFileSync(
      resolve(outDir, `${dbKey}-schema-before.json`),
      JSON.stringify(db, null, 2)
    )

    const byName = new Map<string, PropMeta>()
    for (const p of Object.values(db.properties || {})) {
      byName.set(p.name, p)
    }

    const planned: Array<{
      from: string
      to: string
      id: string
      type: string
      status: "rename" | "already" | "missing_from" | "target_exists"
    }> = []
    const patchProps: Record<string, unknown> = {}

    for (const { from, to } of RENAMES[dbKey]) {
      const src = byName.get(from)
      const dst = byName.get(to)
      if (dst && !src) {
        planned.push({
          from,
          to,
          id: dst.id,
          type: dst.type,
          status: "already",
        })
        continue
      }
      if (!src) {
        planned.push({
          from,
          to,
          id: "",
          type: "",
          status: "missing_from",
        })
        continue
      }
      if (dst && src.id !== dst.id) {
        planned.push({
          from,
          to,
          id: src.id,
          type: src.type,
          status: "target_exists",
        })
        continue
      }
      planned.push({
        from,
        to,
        id: src.id,
        type: src.type,
        status: "rename",
      })
      patchProps[to] = {
        id: src.id,
        name: to,
        type: src.type,
        ...typePayload(src),
      }
    }

    const dbReport = {
      databaseId,
      title: (db.title || []).map((t) => t.plain_text || "").join(""),
      planned,
      renameCount: planned.filter((p) => p.status === "rename").length,
      alreadyCount: planned.filter((p) => p.status === "already").length,
      missingCount: planned.filter((p) => p.status === "missing_from").length,
      conflictCount: planned.filter((p) => p.status === "target_exists").length,
    }
    report.databases = {
      ...(report.databases as object),
      [dbKey]: dbReport,
    }

    console.log(`\n${dbKey} (${dbReport.title || databaseId})`)
    for (const p of planned) {
      console.log(`  [${p.status}] ${p.from} → ${p.to}`)
    }

    if (dbReport.conflictCount > 0) {
      console.error(
        `  CONFLICT: target name already exists with different id — resolve manually`
      )
      process.exitCode = 2
      continue
    }

    if (Object.keys(patchProps).length === 0) {
      console.log("  no renames needed")
      continue
    }

    if (dryRun) {
      console.log(`  would PATCH ${Object.keys(patchProps).length} properties`)
      writeFileSync(
        resolve(outDir, `${dbKey}-patch-dry-run.json`),
        JSON.stringify({ properties: patchProps }, null, 2)
      )
      continue
    }

    await buildinFetch(`/v2/databases/${databaseId}`, {
      method: "PATCH",
      body: { properties: patchProps },
    })
    console.log(`  patched ${Object.keys(patchProps).length} properties`)

    const after = await buildinFetch(`/v2/databases/${databaseId}`)
    writeFileSync(
      resolve(outDir, `${dbKey}-schema-after.json`),
      JSON.stringify(after, null, 2)
    )
  }

  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2))
  console.log(`\nSnapshot/report written to ${outDir}`)
  if (dryRun) {
    console.log("Dry-run only. Re-run with --apply to mutate live schemas.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
