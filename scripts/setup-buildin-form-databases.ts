/**
 * Create only submission_releases / submission_tracks DBs and patch Заявки schema
 * (contact type, Загружается status, Session ID / counts).
 *
 * Usage: npx tsx scripts/setup-buildin-form-databases.ts
 */
import { readFileSync, existsSync, writeFileSync } from "fs"
import { resolve } from "path"
import {
  BUILDIN_DATABASE_DEFS,
  propertiesWithoutRelations,
} from "../lib/buildin/database-defs"
import {
  buildinCreateDatabase,
  buildinFetch,
  buildinGetMe,
} from "../lib/buildin/client"
import { getBuildinApiToken, getBuildinDatabaseId } from "../lib/buildin/env"

const HUB_PAGE_ID =
  process.env.BUILDIN_PARENT_PAGE_ID?.trim() ||
  "1a844652-0f7a-437f-b630-7ebb67eb2fd4"

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

async function ensureDb(
  key: "submission_releases" | "submission_tracks",
  envName: string
): Promise<string> {
  const existing = getBuildinDatabaseId(key)
  if (existing) {
    console.log(`skip ${key}: already ${existing}`)
    return existing
  }
  const def = BUILDIN_DATABASE_DEFS[key]
  console.log(`creating ${key}...`)
  const db = await buildinCreateDatabase({
    parent: { page_id: HUB_PAGE_ID },
    title: def.title,
    icon: def.icon,
    properties: propertiesWithoutRelations(
      def.properties as Record<string, { type: string }>
    ),
  })
  console.log(`  → ${envName}=${db.id}`)
  return db.id
}

async function patchSubmissionsSchema(submissionsId: string) {
  console.log(`patching submissions ${submissionsId}...`)
  const current = await buildinFetch<{
    properties: Record<
      string,
      {
        id: string
        type: string
        select?: { options: Array<{ id: string; name: string; color: string }> }
      }
    >
  }>(`/v2/databases/${submissionsId}`)

  const props: Record<string, unknown> = {}

  const tipo = current.properties["Тип"]
  if (tipo?.type === "select") {
    const names = new Set(tipo.select?.options.map((o) => o.name) || [])
    if (!names.has("contact")) {
      props["Тип"] = {
        select: {
          options: [
            ...(tipo.select?.options || []).map((o) => ({
              id: o.id,
              name: o.name,
              color: o.color,
            })),
            { name: "contact", color: "pink" },
          ],
        },
      }
    }
  }

  const status = current.properties["Статус"]
  if (status?.type === "select") {
    const names = new Set(status.select?.options.map((o) => o.name) || [])
    if (!names.has("Загружается")) {
      props["Статус"] = {
        select: {
          options: [
            { name: "Загружается", color: "grey" },
            ...(status.select?.options || []).map((o) => ({
              id: o.id,
              name: o.name,
              color: o.color,
            })),
          ],
        },
      }
    }
  }

  if (!current.properties["Session ID"]) {
    props["Session ID"] = { rich_text: {} }
  }
  if (!current.properties["Кол-во релизов"]) {
    props["Кол-во релизов"] = { number: { format: "number" } }
  }
  if (!current.properties["Кол-во треков"]) {
    props["Кол-во треков"] = { number: { format: "number" } }
  }

  if (Object.keys(props).length === 0) {
    console.log("  submissions already up to date")
    return
  }

  await buildinFetch(`/v2/databases/${submissionsId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: props }),
  })
  console.log(`  patched: ${Object.keys(props).join(", ")}`)
}

async function wireRelations(
  releasesId: string,
  tracksId: string,
  submissionsId: string
) {
  console.log("wiring relations...")
  await buildinFetch(`/v2/databases/${releasesId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        ЗаявкаRel: {
          relation: {
            database_id: submissionsId,
            type: "single_property",
          },
        },
      },
    }),
  })
  await buildinFetch(`/v2/databases/${tracksId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        РелизЗаявкиRel: {
          relation: {
            database_id: releasesId,
            type: "single_property",
          },
        },
        ЗаявкаRel: {
          relation: {
            database_id: submissionsId,
            type: "single_property",
          },
        },
      },
    }),
  })
  console.log("  relations OK")
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))
  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(2)
  }
  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name}`)

  const releasesId = await ensureDb(
    "submission_releases",
    "BUILDIN_DB_SUBMISSION_RELEASES"
  )
  const tracksId = await ensureDb(
    "submission_tracks",
    "BUILDIN_DB_SUBMISSION_TRACKS"
  )
  const submissionsId = getBuildinDatabaseId("submissions")
  if (!submissionsId) {
    console.error("BUILDIN_DB_SUBMISSIONS missing")
    process.exit(1)
  }

  await patchSubmissionsSchema(submissionsId)
  await wireRelations(releasesId, tracksId, submissionsId)

  const pairs = {
    BUILDIN_DB_SUBMISSION_RELEASES: releasesId,
    BUILDIN_DB_SUBMISSION_TRACKS: tracksId,
  }
  upsertEnvKeys(resolve(process.cwd(), ".env.local"), pairs)
  upsertEnvKeys(resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env"), pairs)
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
