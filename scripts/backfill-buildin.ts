/**
 * One-time / resumable backfill: Postgres ops pool → Buildin.
 *
 *   npm run backfill:buildin -- --dry-run
 *   npm run backfill:buildin
 *   npm run backfill:buildin -- --only=artists,releases,tracks
 *   npm run backfill:buildin -- --force
 *
 * Skips entities that already have BuildinExternalId unless --force.
 * Never syncs passwords, cookies, or StreamAnalytics.
 */
import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { BuildinApiError } from "../lib/buildin/client"
import { getExternalId } from "../lib/buildin/outbox"
import {
  syncArtistToBuildin,
  syncReleaseToBuildin,
  syncTrackToBuildin,
  trackLocalId,
} from "../lib/buildin/adapters/artists-releases"
import {
  syncActivityToBuildin,
  syncParserRunToBuildin,
  syncPlaylistHistoryToBuildin,
  syncPlaylistToBuildin,
  syncReportToBuildin,
} from "../lib/buildin/adapters/ops-mirrors"
import { createSubmissionInBuildin } from "../lib/buildin/adapters/submissions"
import type { FormType } from "../lib/buildin/types"
import { getBuildinApiToken, getBuildinDatabaseId } from "../lib/buildin/env"

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"))
loadEnvFile(resolve(process.cwd(), ".env"))

const ALL_ENTITIES = [
  "artists",
  "releases",
  "tracks",
  "reports",
  "playlists",
  "playlist_history",
  "activity",
  "parser_runs",
  "submissions",
] as const

type Entity = (typeof ALL_ENTITIES)[number]

type Counters = { ok: number; skip: number; fail: number; total: number }

function parseArgs(argv: string[]) {
  let dryRun = false
  let force = false
  let only: Entity[] | null = null
  let delayMs = 150

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true
    else if (arg === "--force") force = true
    else if (arg.startsWith("--only=")) {
      const raw = arg.slice("--only=".length)
      only = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as Entity[]
      for (const e of only) {
        if (!ALL_ENTITIES.includes(e)) {
          throw new Error(`Unknown --only entity: ${e}. Allowed: ${ALL_ENTITIES.join(",")}`)
        }
      }
    } else if (arg.startsWith("--delay=")) {
      delayMs = Math.max(0, Number(arg.slice("--delay=".length)) || 0)
    }
  }

  const entities = only ?? [...ALL_ENTITIES]
  return { dryRun, force, entities, delayMs }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  delayMs: number
): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      const result = await fn()
      if (delayMs > 0) await sleep(delayMs)
      return result
    } catch (err) {
      attempt++
      const status = err instanceof BuildinApiError ? err.status : 0
      const msg = err instanceof Error ? err.message : String(err)
      const retryable =
        status === 429 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        /fetch failed|ECONNRESET|ETIMEDOUT|Connection terminated|Can't reach database|Timed out/i.test(
          msg
        )
      if (!retryable || attempt >= 8) throw err
      const wait = Math.min(90_000, 1500 * 2 ** Math.min(attempt, 5))
      console.warn(`  retry ${label} after ${status || "conn"} (wait ${wait}ms)`)
      await sleep(wait)
    }
  }
}

function emptyCounters(): Counters {
  return { ok: 0, skip: 0, fail: 0, total: 0 }
}

function logCounters(name: string, c: Counters) {
  console.log(
    `[${name}] total=${c.total} ok=${c.ok} skip=${c.skip} fail=${c.fail}`
  )
}

function asTrackArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === "object" && Array.isArray((raw as { tracks?: unknown }).tracks)) {
    return (raw as { tracks: Record<string, unknown>[] }).tracks
  }
  return []
}

async function main() {
  const { dryRun, force, entities, delayMs } = parseArgs(process.argv.slice(2))

  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN / BUILDIN_TOKEN missing")
    process.exit(2)
  }

  const requiredDbs: Array<{ entity: Entity; key: Parameters<typeof getBuildinDatabaseId>[0] }> = [
    { entity: "artists", key: "artists" },
    { entity: "releases", key: "releases" },
    { entity: "tracks", key: "tracks" },
    { entity: "reports", key: "reports" },
    { entity: "playlists", key: "playlists" },
    { entity: "playlist_history", key: "playlist_history" },
    { entity: "activity", key: "activity" },
    { entity: "parser_runs", key: "automation_runs" },
    { entity: "submissions", key: "submissions" },
  ]
  for (const { entity, key } of requiredDbs) {
    if (entities.includes(entity) && !getBuildinDatabaseId(key)) {
      console.error(`Missing BUILDIN_DB for ${key} (needed for --only=${entity})`)
      process.exit(2)
    }
  }

  // Dynamic import after env load so Prisma sees DATABASE_URL
  const { prisma } = await import("../lib/prisma")

  console.log(
    `Backfill Buildin | dryRun=${dryRun} force=${force} delayMs=${delayMs} entities=${entities.join(",")}`
  )

  const [
    artistsN,
    releasesN,
    reportsN,
    playlistsN,
    activityN,
    historyN,
    parserN,
    submissionsN,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "artist" } }),
    prisma.release.count(),
    prisma.report.count(),
    prisma.playlist.count(),
    prisma.activity.count(),
    prisma.playlistHistory.count(),
    prisma.parserRunStatus.count(),
    prisma.formSubmission.count(),
  ])

  let tracksN = 0
  if (entities.includes("tracks") || entities.includes("releases")) {
    const rels = await prisma.release.findMany({ select: { tracks: true } })
    for (const r of rels) tracksN += asTrackArray(r.tracks).length
  }

  console.log("Postgres counts:", {
    artists: artistsN,
    releases: releasesN,
    tracksApprox: tracksN,
    reports: reportsN,
    playlists: playlistsN,
    playlist_history: historyN,
    activity: activityN,
    parser_runs: parserN,
    submissions: submissionsN,
  })

  if (dryRun) {
    console.log("Dry-run only — no writes.")
    await prisma.$disconnect()
    return
  }

  const results: Record<string, Counters> = {}

  if (entities.includes("artists")) {
    const c = emptyCounters()
    const rows = await prisma.user.findMany({
      where: { role: "artist" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        verified: true,
        vkMusicUrl: true,
        yandexMusicUrl: true,
        spotifyUrl: true,
      },
    })
    c.total = rows.length
    for (const a of rows) {
      try {
        const existing = await getExternalId("artist", a.id)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(`artist:${a.id}`, () => syncArtistToBuildin(a), delayMs)
        c.ok++
      } catch (err) {
        c.fail++
        console.error(`  fail artist ${a.id}:`, err instanceof Error ? err.message : err)
      }
    }
    results.artists = c
    logCounters("artists", c)
  }

  if (entities.includes("releases") || entities.includes("tracks")) {
    const cRel = emptyCounters()
    const cTrk = emptyCounters()
    const rows = await prisma.release.findMany({
      select: {
        id: true,
        title: true,
        artistId: true,
        upc: true,
        releaseDate: true,
        type: true,
        status: true,
        coverUrl: true,
        bandlinkUrl: true,
        tracks: true,
      },
    })
    const artistIds = [
      ...new Set(rows.map((r) => r.artistId).filter(Boolean) as string[]),
    ]
    const artists = artistIds.length
      ? await prisma.user.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, name: true },
        })
      : []
    const artistNameById = new Map(artists.map((a) => [a.id, a.name]))

    cRel.total = rows.length
    for (const r of rows) {
      if (entities.includes("releases")) {
        try {
          const existing = await getExternalId("release", r.id)
          if (existing && !force) {
            cRel.skip++
          } else {
            await withRetry(
              `release:${r.id}`,
              () =>
                syncReleaseToBuildin({
                  id: r.id,
                  title: r.title,
                  artistId: r.artistId,
                  artistName: r.artistId
                    ? artistNameById.get(r.artistId) ?? null
                    : null,
                  upc: r.upc,
                  releaseDate: r.releaseDate,
                  type: r.type,
                  autoStatus: r.status,
                  // Never set Ops Status on backfill — Buildin-owned
                  coverUrl: r.coverUrl,
                  bandlinkUrl: r.bandlinkUrl,
                }),
              delayMs
            )
            cRel.ok++
          }
        } catch (err) {
          cRel.fail++
          console.error(`  fail release ${r.id}:`, err instanceof Error ? err.message : err)
        }
      }

      if (entities.includes("tracks")) {
        const tracks = asTrackArray(r.tracks)
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i]
          cTrk.total++
          const localId = trackLocalId(
            r.id,
            {
              id: typeof t.id === "string" ? t.id : null,
              isrc: typeof t.isrc === "string" ? t.isrc : null,
            },
            i
          )
          try {
            const existing = await getExternalId("track", localId)
            if (existing && !force) {
              cTrk.skip++
              continue
            }
            const featured =
              Array.isArray(t.featuredArtistNames)
                ? (t.featuredArtistNames as string[]).join(", ")
                : ""
            await withRetry(
              `track:${localId}`,
              () =>
                syncTrackToBuildin({
                  id: localId,
                  title: String(t.title || `Track ${i + 1}`),
                  releaseLocalId: r.id,
                  isrc: typeof t.isrc === "string" ? t.isrc : null,
                  artists: featured || null,
                  duration: typeof t.duration === "string" ? t.duration : null,
                  explicit: t.explicit === true,
                  focus: t.focus === true,
                  language: typeof t.language === "string" ? t.language : null,
                }),
              delayMs
            )
            cTrk.ok++
          } catch (err) {
            cTrk.fail++
            console.error(
              `  fail track ${localId}:`,
              err instanceof Error ? err.message : err
            )
          }
        }
      }
    }
    if (entities.includes("releases")) {
      results.releases = cRel
      logCounters("releases", cRel)
    }
    if (entities.includes("tracks")) {
      results.tracks = cTrk
      logCounters("tracks", cTrk)
    }
  }

  if (entities.includes("reports")) {
    const c = emptyCounters()
    const rows = await prisma.report.findMany()
    c.total = rows.length
    for (const r of rows) {
      try {
        const existing = await getExternalId("report", r.id)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(
          `report:${r.id}`,
          () =>
            syncReportToBuildin({
              id: r.id,
              artistId: r.artistId,
              artistName: r.artistName,
              quarter: r.quarter,
              year: r.year,
              totalAmount: r.totalAmount,
              totalPlays: r.totalPlays,
              isPaid: r.isPaid,
              isSigned: r.isSigned,
              isAcknowledged: r.isAcknowledged,
              isRegistered: r.isRegistered,
              fileUrl: r.fileUrl,
            }),
          delayMs
        )
        c.ok++
      } catch (err) {
        c.fail++
        console.error(`  fail report ${r.id}:`, err instanceof Error ? err.message : err)
      }
    }
    results.reports = c
    logCounters("reports", c)
  }

  if (entities.includes("playlists")) {
    const c = emptyCounters()
    const rows = await prisma.playlistTrackPlacement.findMany({
      where: { isActive: true },
    })
    c.total = rows.length
    for (const p of rows) {
      try {
        const existing = await getExternalId("playlist_placement", p.placementKey)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(
          `playlist_placement:${p.placementKey}`,
          () =>
            syncPlaylistToBuildin({
              id: p.placementKey,
              trackTitle: p.trackTitle,
              artistName: p.artistName,
              playlistName: p.playlistName,
              playlistUrl: p.playlistUrl,
              firstSeenDate: p.firstSeenDate,
            }),
          delayMs
        )
        c.ok++
      } catch (err) {
        c.fail++
        console.error(
          `  fail playlist_placement ${p.placementKey}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
    results.playlists = c
    logCounters("playlists", c)
  }

  if (entities.includes("playlist_history")) {
    const c = emptyCounters()
    const rows = await prisma.playlistHistory.findMany()
    c.total = rows.length
    for (const h of rows) {
      try {
        const existing = await getExternalId("playlist_history", h.id)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(
          `playlist_history:${h.id}`,
          () =>
            syncPlaylistHistoryToBuildin({
              id: h.id,
              playlistName: h.playlistName,
              playlistUrl: h.playlistUrl,
              platform: h.platform,
              changeType: h.changeType,
              changeDate: h.changeDate,
              artistName: h.artistName,
              trackTitle: h.trackTitle,
            }),
          delayMs
        )
        c.ok++
      } catch (err) {
        c.fail++
        console.error(
          `  fail playlist_history ${h.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
    results.playlist_history = c
    logCounters("playlist_history", c)
  }

  if (entities.includes("activity")) {
    const c = emptyCounters()
    const rows = await prisma.activity.findMany({
      orderBy: { createdAt: "asc" },
    })
    c.total = rows.length
    for (const a of rows) {
      try {
        const existing = await getExternalId("activity", a.id)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(
          `activity:${a.id}`,
          () =>
            syncActivityToBuildin({
              id: a.id,
              type: a.type,
              userId: a.userId,
              userRole: a.userRole,
              title: a.title,
              description: a.description,
              createdAt: a.createdAt,
            }),
          delayMs
        )
        c.ok++
      } catch (err) {
        c.fail++
        console.error(`  fail activity ${a.id}:`, err instanceof Error ? err.message : err)
      }
    }
    results.activity = c
    logCounters("activity", c)
  }

  if (entities.includes("parser_runs")) {
    const c = emptyCounters()
    const rows = await prisma.parserRunStatus.findMany()
    c.total = rows.length
    for (const run of rows) {
      try {
        const existing = await getExternalId("parser_run", run.platform)
        if (existing && !force) {
          c.skip++
          continue
        }
        await withRetry(
          `parser:${run.platform}`,
          () =>
            syncParserRunToBuildin({
              platform: run.platform,
              status: run.status,
              lastRun: run.lastRun,
              needsNewCookies: run.needsNewCookies,
              failedAttempts: run.failedAttempts,
              lastError: run.lastError ? String(run.lastError).slice(0, 500) : null,
              adminLink: "/dashboard/admin/parsers",
            }),
          delayMs
        )
        c.ok++
      } catch (err) {
        c.fail++
        console.error(
          `  fail parser ${run.platform}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
    results.parser_runs = c
    logCounters("parser_runs", c)
  }

  if (entities.includes("submissions")) {
    const c = emptyCounters()
    const rows = await prisma.formSubmission.findMany({
      orderBy: { createdAt: "asc" },
    })
    c.total = rows.length
    for (const s of rows) {
      try {
        if (s.buildinPageId && !force) {
          c.skip++
          continue
        }
        const existing = await getExternalId("submission", s.id)
        if (existing && !force) {
          if (!s.buildinPageId) {
            await prisma.formSubmission.update({
              where: { id: s.id },
              data: { buildinPageId: existing.buildinPageId },
            })
          }
          c.skip++
          continue
        }
        const created = await withRetry(
          `submission:${s.id}`,
          () =>
            createSubmissionInBuildin({
              submissionId: s.id,
              formType: s.formType as FormType,
              title: s.title,
              contactEmail: s.contactEmail,
              contactTelegram: s.contactTelegram,
              artistNickname: s.artistNickname,
              payload: (s.payload as Record<string, unknown>) ?? {},
              pyrusTaskId: s.pyrusTaskId,
              files: [],
            }),
          delayMs
        )
        await prisma.formSubmission.update({
          where: { id: s.id },
          data: {
            buildinPageId: created.pageId,
            status: s.status === "failed" || s.status === "partial" ? "completed" : s.status,
            lastError: null,
          },
        })
        c.ok++
      } catch (err) {
        c.fail++
        console.error(
          `  fail submission ${s.id}:`,
          err instanceof Error ? err.message : err
        )
      }
    }
    results.submissions = c
    logCounters("submissions", c)
  }

  const mapped = await prisma.buildinExternalId.groupBy({
    by: ["entityType"],
    _count: true,
  })
  console.log("\nBuildinExternalId after backfill:")
  console.log(mapped)
  console.log("\nSummary:", results)

  const failed = Object.values(results).some((c) => c.fail > 0)
  await prisma.$disconnect()
  if (failed) process.exit(1)
  console.log("Backfill OK")
}

main().catch(async (err) => {
  console.error(err)
  try {
    const { prisma } = await import("../lib/prisma")
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
