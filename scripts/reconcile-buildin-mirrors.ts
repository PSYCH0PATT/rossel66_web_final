/**
 * CLI reconciliation for active Buildin mirrors.
 * Usage: npx tsx scripts/reconcile-buildin-mirrors.ts
 */
import { readFileSync, existsSync } from "fs"
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

import { prisma } from "../lib/prisma"
import {
  getBuildinApiToken,
  getBuildinDatabaseId,
} from "../lib/buildin/env"
import { buildinQueryDatabase } from "../lib/buildin/client"

async function countBuildinPages(dbKey: Parameters<typeof getBuildinDatabaseId>[0]) {
  const dbId = getBuildinDatabaseId(dbKey)
  if (!dbId) return { ok: false as const, count: 0, error: "missing_db_id" }
  let count = 0
  let cursor: string | null = null
  try {
    do {
      const page = await buildinQueryDatabase(dbId, {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      })
      count += page.results?.length ?? 0
      cursor = page.has_more ? page.next_cursor : null
    } while (cursor)
    return { ok: true as const, count }
  } catch (err) {
    return {
      ok: false as const,
      count,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN missing")
    process.exit(2)
  }

  const entities: Array<{
    key: Parameters<typeof getBuildinDatabaseId>[0]
    entityType: string
    postgres: () => Promise<number>
  }> = [
    {
      key: "submissions",
      entityType: "submission",
      postgres: () => prisma.formSubmission.count(),
    },
    {
      key: "artists",
      entityType: "artist",
      postgres: () => prisma.user.count({ where: { role: "artist" } }),
    },
    {
      key: "releases",
      entityType: "release",
      postgres: () => prisma.release.count(),
    },
    {
      key: "tracks",
      entityType: "track",
      postgres: async () =>
        prisma.buildinExternalId.count({ where: { entityType: "track" } }),
    },
    {
      key: "reports",
      entityType: "report",
      postgres: () => prisma.report.count(),
    },
    {
      key: "playlists",
      entityType: "playlist_placement",
      postgres: () =>
        prisma.playlistTrackPlacement.count({ where: { isActive: true } }),
    },
  ]

  const [outboxPending, outboxDead, outboxProcessing] = await Promise.all([
    prisma.buildinOutbox.count({
      where: { status: { in: ["pending", "failed"] } },
    }),
    prisma.buildinOutbox.count({ where: { status: "dead" } }),
    prisma.buildinOutbox.count({ where: { status: "processing" } }),
  ])

  console.log("=== Buildin mirror reconciliation ===")
  console.log(
    JSON.stringify({ outboxPending, outboxProcessing, outboxDead }, null, 2)
  )

  for (const e of entities) {
    const [pg, mapped, buildin] = await Promise.all([
      e.postgres(),
      prisma.buildinExternalId.count({ where: { entityType: e.entityType } }),
      countBuildinPages(e.key),
    ])
    console.log(
      JSON.stringify(
        {
          entity: e.entityType,
          postgres: pg,
          mapped,
          missingMapping: Math.max(0, pg - mapped),
          buildin,
        },
        null,
        2
      )
    )
  }

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
