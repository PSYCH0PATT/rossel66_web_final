/**
 * Prove form intake never targets CRM releases/tracks, and PII DBs lack Payload JSON.
 * Read-only. Usage: npx tsx scripts/audit-buildin-forms-crm-separation.ts
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve } from "path"
import { BUILDIN_DATABASE_DEFS } from "../lib/buildin/database-defs"
import { FORM_QUEUE_CONTRACTS } from "../lib/buildin/form-contracts"
import { formTypeToDatabaseKey } from "../lib/buildin/env"
import { buildinFetch, buildinGetMe } from "../lib/buildin/client"
import { getBuildinApiToken } from "../lib/buildin/env"

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
  loadEnvFile(resolve(".env.local"))
  loadEnvFile(resolve("docs/BUILDIN_DATABASE_IDS.env"))
  if (!getBuildinApiToken()) throw new Error("BUILDIN_API_TOKEN required")
  const me = await buildinGetMe()

  const routing = {
    catalog_upload: formTypeToDatabaseKey("catalog_upload") as string,
    release_upload: formTypeToDatabaseKey("release_upload") as string,
    distribution: formTypeToDatabaseKey("distribution") as string,
    contact: formTypeToDatabaseKey("contact") as string,
  }
  const asserts: string[] = []
  if (routing.catalog_upload === "releases" || routing.catalog_upload === "tracks") {
    asserts.push("FAIL: catalog routes to CRM")
  }
  if (routing.release_upload === "releases" || routing.release_upload === "tracks") {
    asserts.push("FAIL: release routes to CRM")
  }
  if (routing.distribution === "releases" || routing.distribution === "tracks") {
    asserts.push("FAIL: distribution routes to CRM")
  }
  for (const [ft, c] of Object.entries(FORM_QUEUE_CONTRACTS)) {
    if (c.dbKey !== routing[ft as keyof typeof routing]) {
      asserts.push(`FAIL: contract dbKey mismatch for ${ft}`)
    }
  }

  const piiRf = BUILDIN_DATABASE_DEFS.pii_rf.properties
  const piiNot = BUILDIN_DATABASE_DEFS.pii_not_rf.properties
  if ("Payload JSON" in piiRf || "Payload JSON" in piiNot) {
    asserts.push("FAIL: Payload JSON still in PII defs")
  }

  const live: Record<string, string[]> = {}
  for (const key of ["artists", "releases", "tracks", "reports", "pii_rf", "pii_not_rf"] as const) {
    const env =
      key === "artists"
        ? process.env.BUILDIN_DB_ARTISTS
        : key === "releases"
          ? process.env.BUILDIN_DB_RELEASES
          : key === "tracks"
            ? process.env.BUILDIN_DB_TRACKS
            : key === "reports"
              ? process.env.BUILDIN_DB_REPORTS
              : key === "pii_rf"
                ? process.env.BUILDIN_DB_PII_RF
                : process.env.BUILDIN_DB_PII_NOT_RF
    if (!env) {
      live[key] = ["missing env"]
      continue
    }
    const db = (await buildinFetch(`/v2/databases/${env}`)) as {
      properties: Record<string, { name: string }>
    }
    live[key] = Object.values(db.properties).map((p) => p.name)
  }

  const outDir = resolve("tmp", `forms-crm-audit-${Date.now()}`)
  mkdirSync(outDir, { recursive: true })
  const report = {
    checkedAt: new Date().toISOString(),
    me: me.name,
    routing,
    asserts,
    livePropertyNames: live,
    piiHasPayloadJson: {
      rf: live.pii_rf?.includes("Payload JSON") || false,
      notRf: live.pii_not_rf?.includes("Payload JSON") || false,
    },
    note7_4:
      "Buildin OpenAPI getDatabase has no views field — hiding diagnostic columns requires owner UI (docs/BUILDIN_CRM_VIEW_CHECKLIST.md)",
  }
  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (asserts.length || report.piiHasPayloadJson.rf || report.piiHasPayloadJson.notRf) {
    process.exit(2)
  }
  console.log(`OK → ${outDir}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
