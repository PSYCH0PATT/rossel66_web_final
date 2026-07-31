/**
 * One-shot checkpoint of local mapping counts before Buildin workspace mutation.
 * Writes to .tmp/buildin-checkpoint/ (gitignored ideally).
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs"
import { resolve } from "path"

function loadEnv(filePath: string) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

loadEnv(resolve(process.cwd(), ".env.local"))
loadEnv(resolve(process.cwd(), ".env"))

async function main() {
  const { prisma } = await import("../lib/prisma")
  const outDir = resolve(process.cwd(), ".tmp/buildin-checkpoint")
  mkdirSync(outDir, { recursive: true })

  const entities = [
    "submission",
    "artist",
    "release",
    "track",
    "report",
    "playlist",
    "pii_rf",
    "pii_not_rf",
    "activity",
    "playlist_history",
    "parser_run",
  ] as const

  const mapped: Record<string, number> = {}
  for (const e of entities) {
    mapped[e] = await prisma.buildinExternalId.count({ where: { entityType: e } })
  }

  const out = {
    capturedAt: new Date().toISOString(),
    mapped,
    postgres: {
      formSubmissions: await prisma.formSubmission.count(),
      artists: await prisma.user.count({ where: { role: "artist" } }),
      releases: await prisma.release.count(),
      reports: await prisma.report.count(),
      playlists: await prisma.playlist.count(),
    },
    outbox: {
      pendingOrFailed: await prisma.buildinOutbox.count({
        where: { status: { in: ["pending", "failed"] } },
      }),
      processing: await prisma.buildinOutbox.count({
        where: { status: "processing" },
      }),
      dead: await prisma.buildinOutbox.count({ where: { status: "dead" } }),
    },
    remoteKnownGaps: [
      "Assignee still rich_text on artists/releases/reports",
      "Status options still English machine values",
      "PII DBs still have Payload JSON",
      "No Ops Center page",
      "No relation properties yet",
    ],
  }

  writeFileSync(resolve(outDir, "postgres-counts.json"), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  process.exit(1)
})
