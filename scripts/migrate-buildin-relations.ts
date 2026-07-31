/**
 * Backfill Buildin relation properties from exact BuildinExternalId mappings.
 *
 * Never overwrites Ops Status / Assignee / Notes / Deadline.
 * Never uses fuzzy matching — only exact local IDs.
 *
 * Usage:
 *   npx tsx scripts/migrate-buildin-relations.ts --dry-run
 *   npx tsx scripts/migrate-buildin-relations.ts
 *   npx tsx scripts/migrate-buildin-relations.ts --batch=40
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
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
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"))
loadEnvFile(resolve(process.cwd(), ".env"))
loadEnvFile(resolve(process.cwd(), "docs/BUILDIN_DATABASE_IDS.env"))

import { prisma } from "../lib/prisma"
import { getBuildinApiToken, getBuildinDatabaseId } from "../lib/buildin/env"
import { buildinGetDatabase, buildinUpdatePage } from "../lib/buildin/client"
import { relationProp, textProp } from "../lib/buildin/types"

const dryRun = process.argv.includes("--dry-run")
const batchArg = process.argv.find((a) => a.startsWith("--batch="))
const BATCH = batchArg ? Math.max(1, Number(batchArg.split("=")[1]) || 25) : 25

type DirectionKey =
  | "release→artist"
  | "track→release"
  | "report→artist"
  | "playlist→artist"
  | "pii_rf→submission"
  | "pii_not_rf→submission"
  | "submission→artist"
  | "submission→release"

type DirectionStat = {
  scanned: number
  updated: number
  unmatched: number
  skippedNoSource: number
  errors: number
  unmatchedSamples: string[]
}

function emptyStat(): DirectionStat {
  return {
    scanned: 0,
    updated: 0,
    unmatched: 0,
    skippedNoSource: 0,
    errors: 0,
    unmatchedSamples: [],
  }
}

function pushSample(stat: DirectionStat, id: string) {
  if (stat.unmatchedSamples.length < 20) stat.unmatchedSamples.push(id)
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function mapByLocalId(entityType: string) {
  const rows = await prisma.buildinExternalId.findMany({
    where: { entityType },
    select: { localId: true, buildinPageId: true },
  })
  const map = new Map<string, string>()
  for (const r of rows) map.set(r.localId, r.buildinPageId)
  return map
}

async function verifyRelationSchema() {
  const checks: Array<{ key: string; dbKey: string; prop: string }> = [
    { key: "releases", dbKey: "releases", prop: "АртистRel" },
    { key: "tracks", dbKey: "tracks", prop: "РелизRel" },
    { key: "reports", dbKey: "reports", prop: "АртистRel" },
    { key: "playlists", dbKey: "playlists", prop: "АртистRel" },
    { key: "pii_rf", dbKey: "pii_rf", prop: "ЗаявкаRel" },
    { key: "pii_not_rf", dbKey: "pii_not_rf", prop: "ЗаявкаRel" },
    { key: "submissions", dbKey: "submissions", prop: "АртистRel" },
  ]

  const missing: string[] = []
  for (const c of checks) {
    const dbId = getBuildinDatabaseId(c.dbKey as never)
    if (!dbId) {
      missing.push(`${c.key}: missing env BUILDIN_DB`)
      continue
    }
    const db = await buildinGetDatabase(dbId)
    const props = (db as { properties?: Record<string, { type?: string }> })
      .properties
    const p = props?.[c.prop]
    if (!p || p.type !== "relation") {
      missing.push(`${c.key}.${c.prop}`)
    }
  }
  return missing
}

async function updateRelation(
  pageId: string,
  properties: Record<string, unknown>
) {
  if (dryRun) return
  await buildinUpdatePage(pageId, { properties })
}

async function main() {
  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN missing")
    process.exit(2)
  }

  const outDir = resolve(process.cwd(), ".tmp/buildin-checkpoint")
  mkdirSync(outDir, { recursive: true })

  console.log(dryRun ? "=== DRY RUN ===" : "=== LIVE RELATION BACKFILL ===")
  console.log(`batch=${BATCH}`)

  console.log("Verifying remote relation schema…")
  const missing = await verifyRelationSchema()
  if (missing.length) {
    console.error("Missing relation properties:", missing.join(", "))
    process.exit(3)
  }
  console.log("Schema OK")

  const artistPages = await mapByLocalId("artist")
  const releasePages = await mapByLocalId("release")
  const submissionPages = await mapByLocalId("submission")

  const stats: Record<DirectionKey, DirectionStat> = {
    "release→artist": emptyStat(),
    "track→release": emptyStat(),
    "report→artist": emptyStat(),
    "playlist→artist": emptyStat(),
    "pii_rf→submission": emptyStat(),
    "pii_not_rf→submission": emptyStat(),
    "submission→artist": emptyStat(),
    "submission→release": emptyStat(),
  }

  // --- release → artist ---
  {
    const mappings = await prisma.buildinExternalId.findMany({
      where: { entityType: "release" },
    })
    for (let i = 0; i < mappings.length; i += BATCH) {
      const chunk = mappings.slice(i, i + BATCH)
      for (const m of chunk) {
        const st = stats["release→artist"]
        st.scanned++
        const release = await prisma.release.findUnique({
          where: { id: m.localId },
          select: { id: true, artistId: true },
        })
        if (!release?.artistId) {
          st.skippedNoSource++
          continue
        }
        const artistPageId = artistPages.get(release.artistId)
        if (!artistPageId) {
          st.unmatched++
          pushSample(st, `${release.id}→${release.artistId}`)
          continue
        }
        try {
          await updateRelation(m.buildinPageId, {
            "Artist ID": textProp(release.artistId),
            "Local ID": textProp(release.id),
            АртистRel: relationProp([artistPageId]),
          })
          st.updated++
        } catch (e) {
          st.errors++
          console.error("release→artist", m.localId, e)
        }
      }
      if (!dryRun) await sleep(200)
      process.stdout.write(
        `\rrelease→artist ${Math.min(i + BATCH, mappings.length)}/${mappings.length}`
      )
    }
    console.log("")
  }

  // --- track → release ---
  // Exact sources only: localId "releaseId:…" OR track.id found inside release.tracks JSON
  const trackIdToRelease = new Map<string, string>()
  {
    const releases = await prisma.release.findMany({
      select: { id: true, tracks: true },
    })
    for (const r of releases) {
      const tracks = Array.isArray(r.tracks) ? r.tracks : []
      for (const raw of tracks) {
        if (!raw || typeof raw !== "object") continue
        const id = (raw as { id?: unknown }).id
        if (typeof id === "string" && id.trim()) {
          trackIdToRelease.set(id.trim(), r.id)
        }
      }
    }
  }

  {
    const mappings = await prisma.buildinExternalId.findMany({
      where: { entityType: "track" },
    })
    for (let i = 0; i < mappings.length; i += BATCH) {
      const chunk = mappings.slice(i, i + BATCH)
      for (const m of chunk) {
        const st = stats["track→release"]
        st.scanned++
        let releaseLocalId: string | null = null
        if (m.localId.includes(":")) {
          releaseLocalId = m.localId.split(":")[0] || null
        } else {
          releaseLocalId = trackIdToRelease.get(m.localId) || null
        }
        if (!releaseLocalId) {
          st.skippedNoSource++
          continue
        }
        const releasePageId = releasePages.get(releaseLocalId)
        if (!releasePageId) {
          st.unmatched++
          pushSample(st, `${m.localId}→${releaseLocalId}`)
          continue
        }
        try {
          await updateRelation(m.buildinPageId, {
            "Release Local ID": textProp(releaseLocalId),
            "Local ID": textProp(m.localId),
            РелизRel: relationProp([releasePageId]),
          })
          st.updated++
        } catch (e) {
          st.errors++
          console.error("track→release", m.localId, e)
        }
      }
      if (!dryRun) await sleep(200)
      process.stdout.write(
        `\rtrack→release ${Math.min(i + BATCH, mappings.length)}/${mappings.length}`
      )
    }
    console.log("")
  }

  // --- report → artist ---
  {
    const mappings = await prisma.buildinExternalId.findMany({
      where: { entityType: "report" },
    })
    for (const m of mappings) {
      const st = stats["report→artist"]
      st.scanned++
      const report = await prisma.report.findUnique({
        where: { id: m.localId },
        select: { id: true, artistId: true },
      })
      if (!report?.artistId) {
        st.skippedNoSource++
        continue
      }
      const artistPageId = artistPages.get(report.artistId)
      if (!artistPageId) {
        st.unmatched++
        pushSample(st, `${report.id}→${report.artistId}`)
        continue
      }
      try {
        await updateRelation(m.buildinPageId, {
          "Artist ID": textProp(report.artistId),
          "Local ID": textProp(report.id),
          АртистRel: relationProp([artistPageId]),
        })
        st.updated++
      } catch (e) {
        st.errors++
        console.error("report→artist", m.localId, e)
      }
    }
  }

  // --- playlist → artist (removed: slim placements no longer use АртистRel) ---
  {
    const st = stats["playlist→artist"]
    st.scanned = 0
    console.log("Skipping playlist→artist relation backfill (slim placement schema)")
  }

  // --- PII → submission ---
  for (const entity of ["pii_rf", "pii_not_rf"] as const) {
    const key =
      entity === "pii_rf"
        ? ("pii_rf→submission" as const)
        : ("pii_not_rf→submission" as const)
    const mappings = await prisma.buildinExternalId.findMany({
      where: { entityType: entity },
    })
    for (const m of mappings) {
      const st = stats[key]
      st.scanned++
      const submissionPageId = submissionPages.get(m.localId)
      if (!submissionPageId) {
        st.unmatched++
        pushSample(st, m.localId)
        continue
      }
      try {
        await updateRelation(m.buildinPageId, {
          "Submission ID": textProp(m.localId),
          ЗаявкаRel: relationProp([submissionPageId]),
        })
        st.updated++
      } catch (e) {
        st.errors++
        console.error(key, m.localId, e)
      }
    }
  }

  // --- submission → artist / release (exact IDs from FormSubmission if present) ---
  {
    const mappings = await prisma.buildinExternalId.findMany({
      where: { entityType: "submission" },
    })
    for (const m of mappings) {
      const row = await prisma.formSubmission.findUnique({
        where: { id: m.localId },
        select: { id: true, payload: true },
      })
      if (!row) {
        stats["submission→artist"].skippedNoSource++
        stats["submission→release"].skippedNoSource++
        continue
      }
      const payload =
        row.payload && typeof row.payload === "object"
          ? (row.payload as Record<string, unknown>)
          : {}
      const artistLocalId =
        typeof payload.artistId === "string"
          ? payload.artistId
          : typeof payload.artistLocalId === "string"
            ? payload.artistLocalId
            : null
      const releaseLocalId =
        typeof payload.releaseId === "string"
          ? payload.releaseId
          : typeof payload.releaseLocalId === "string"
            ? payload.releaseLocalId
            : null

      const props: Record<string, unknown> = {}
      if (artistLocalId) {
        stats["submission→artist"].scanned++
        props["Artist Local ID"] = textProp(artistLocalId)
        const pageId = artistPages.get(artistLocalId)
        if (pageId) {
          props["АртистRel"] = relationProp([pageId])
          stats["submission→artist"].updated++
        } else {
          stats["submission→artist"].unmatched++
          pushSample(stats["submission→artist"], `${m.localId}→${artistLocalId}`)
        }
      } else {
        stats["submission→artist"].skippedNoSource++
      }

      if (releaseLocalId) {
        stats["submission→release"].scanned++
        props["Release Local ID"] = textProp(releaseLocalId)
        const pageId = releasePages.get(releaseLocalId)
        if (pageId) {
          props["РелизRel"] = relationProp([pageId])
          stats["submission→release"].updated++
        } else {
          stats["submission→release"].unmatched++
          pushSample(
            stats["submission→release"],
            `${m.localId}→${releaseLocalId}`
          )
        }
      } else {
        stats["submission→release"].skippedNoSource++
      }

      if (Object.keys(props).length) {
        try {
          await updateRelation(m.buildinPageId, props)
        } catch (e) {
          stats["submission→artist"].errors++
          console.error("submission relations", m.localId, e)
        }
      }
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    dryRun,
    batch: BATCH,
    artistMappings: artistPages.size,
    releaseMappings: releasePages.size,
    submissionMappings: submissionPages.size,
    stats,
  }

  const outPath = resolve(
    outDir,
    dryRun ? "relations-dry-run.json" : "relations-backfill-report.json"
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log("Wrote", outPath)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
