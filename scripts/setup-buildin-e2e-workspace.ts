/**
 * Idempotent Buildin E2E sandbox under a dedicated parent page.
 *
 * Creates (or reuses) databases with titles prefixed «E2E — …» and writes IDs to:
 *   docs/FORMS_E2E_DATABASE_IDS.env
 *   .env.e2e.local (gitignored)
 *
 * Usage:
 *   BUILDIN_API_TOKEN=… npx tsx scripts/setup-buildin-e2e-workspace.ts
 *   BUILDIN_E2E_PARENT_PAGE_ID=… npx tsx scripts/setup-buildin-e2e-workspace.ts
 *
 * Never points production BUILDIN_DB_* at these IDs.
 */
import { readFileSync, existsSync, writeFileSync } from "fs"
import { resolve } from "path"
import {
  BUILDIN_DATABASE_DEFS,
  propertiesWithoutRelations,
  type BuildinDatabaseDefKey,
} from "../lib/buildin/database-defs"
import {
  buildinCreateDatabase,
  buildinCreatePage,
  buildinFetch,
  buildinGetMe,
} from "../lib/buildin/client"
import { getBuildinApiToken, BUILDIN_DB_ENV_NAMES } from "../lib/buildin/env"

const E2E_DB_KEYS: BuildinDatabaseDefKey[] = [
  "submissions",
  "form_back_catalog",
  "form_release_upload",
  "form_distribution",
  "pii_rf",
  "pii_not_rf",
]

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
    if (re.test(text)) text = text.replace(re, `${key}=${value}`)
    else text = text.replace(/\s*$/, `\n${key}=${value}\n`)
  }
  writeFileSync(filePath, text)
}

function e2eTitle(defTitle: Array<{ plain_text?: string; text?: { content?: string } }>) {
  const base =
    defTitle.map((t) => t.plain_text || t.text?.content || "").join("") || "DB"
  return [
    {
      type: "text",
      text: { content: `E2E — ${base.replace(/^ROSSEL — /, "")}`, link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
      plain_text: `E2E — ${base.replace(/^ROSSEL — /, "")}`,
      href: null,
    },
  ]
}

async function ensureParentPage(): Promise<string> {
  const existing = process.env.BUILDIN_E2E_PARENT_PAGE_ID?.trim()
  if (existing) {
    console.log(`Using BUILDIN_E2E_PARENT_PAGE_ID=${existing}`)
    return existing
  }
  // Prefer dedicated E2E parent under shared hub when creating new page
  const hub =
    process.env.BUILDIN_PARENT_PAGE_ID?.trim() ||
    "1a844652-0f7a-437f-b630-7ebb67eb2fd4"
  console.log(`Creating parent page «ROSSEL — E2E Sandbox» under hub ${hub}…`)
  const page = await buildinCreatePage(
    {
      parent: { page_id: hub },
      properties: {
        title: [
          {
            type: "text",
            text: { content: "ROSSEL — E2E Sandbox", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "ROSSEL — E2E Sandbox",
            href: null,
          },
        ],
      },
    },
    "rossel-e2e-sandbox-parent-v1"
  )
  console.log(`  → BUILDIN_E2E_PARENT_PAGE_ID=${page.id}`)
  return page.id
}

async function findExistingDbId(
  parentId: string,
  titleNeedle: string
): Promise<string | null> {
  // Buildin has no reliable search-by-title across workspace in all plans;
  // reuse env if present.
  void parentId
  void titleNeedle
  return null
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"))
  loadEnvFile(resolve(process.cwd(), ".env.e2e.local"))
  loadEnvFile(resolve(process.cwd(), ".env"))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN required")
    process.exit(2)
  }

  const me = await buildinGetMe()
  console.log(`Authenticated as ${me.name} @ ${me.workspace_name}`)

  const parentId = await ensureParentPage()
  const results: Record<string, string> = {
    BUILDIN_E2E_PARENT_PAGE_ID: parentId,
  }

  for (const key of E2E_DB_KEYS) {
    const envName = ENV_NAMES[key]
    const existing = process.env[`E2E_${envName}`]?.trim()
    if (existing) {
      console.log(`skip ${key}: E2E_${envName}=${existing}`)
      results[`E2E_${envName}`] = existing
      continue
    }

    const found = await findExistingDbId(parentId, key)
    if (found) {
      results[`E2E_${envName}`] = found
      continue
    }

    const def = BUILDIN_DATABASE_DEFS[key]
    console.log(`creating E2E ${key}…`)
    const db = await buildinCreateDatabase({
      parent: { page_id: parentId },
      title: e2eTitle(def.title as never),
      icon: def.icon,
      properties: propertiesWithoutRelations(
        def.properties as Record<string, { type: string }>
      ),
    })
    console.log(`  → E2E_${envName}=${db.id}`)
    results[`E2E_${envName}`] = db.id
  }

  // Wire PII → questionnaires inbox relations
  const submissionsId = results.E2E_BUILDIN_DB_SUBMISSIONS
  const piiRfId = results.E2E_BUILDIN_DB_PII_RF
  const piiNotRfId = results.E2E_BUILDIN_DB_PII_NOT_RF
  for (const [label, piiId] of [
    ["pii_rf", piiRfId],
    ["pii_not_rf", piiNotRfId],
  ] as const) {
    if (!piiId || !submissionsId) continue
    await buildinFetch(`/v2/databases/${piiId}`, {
      method: "PATCH",
      body: { properties: { ЗаявкаRel: null } },
    }).catch((err) => console.warn(`clear ${label} ЗаявкаRel:`, err))
    await buildinFetch(`/v2/databases/${piiId}`, {
      method: "PATCH",
      body: {
        properties: {
          ЗаявкаRel: {
            type: "relation",
            relation: { database_id: submissionsId, type: "single_property" },
          },
        },
      },
    }).catch((err) => console.warn(`relation ${label}→submissions:`, err))
  }

  const header = [
    "# Buildin E2E sandbox database IDs (NOT production)",
    "# Copy E2E_* into Vercel Preview/Staging env as BUILDIN_DB_* (without E2E_ prefix)",
    "# or keep E2E_* in GitHub Actions secrets and map in workflow.",
    "",
    "BUILDIN_API_BASE_URL=https://api.buildin.ai",
    "PYRUS_WRITE_DISABLED=true",
    "BUILDIN_DUAL_WRITE=true",
    "",
  ].join("\n")

  const body = Object.entries(results)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  writeFileSync(
    resolve(process.cwd(), "docs/FORMS_E2E_DATABASE_IDS.env"),
    `${header}${body}\n`
  )
  upsertEnvKeys(resolve(process.cwd(), ".env.e2e.local"), results)

  console.log("\nWrote docs/FORMS_E2E_DATABASE_IDS.env and .env.e2e.local")
  console.log(
    "Map E2E_BUILDIN_DB_* → BUILDIN_DB_* on Vercel staging / GitHub Actions only."
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
