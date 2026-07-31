/**
 * Migrate playlist mirrors to one Buildin row per track placement.
 *
 * Usage:
 *   npx tsx scripts/migrate-buildin-playlist-placements.ts --dry-run
 *   npx tsx scripts/migrate-buildin-playlist-placements.ts
 *   npx tsx scripts/migrate-buildin-playlist-placements.ts --cleanup-schema
 *   npx tsx scripts/migrate-buildin-playlist-placements.ts --archive-legacy
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs"
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
  requireBuildinDatabaseId,
} from "../lib/buildin/env"
import {
  buildinGetDatabase,
  buildinUpdatePage,
  buildinMutateDatabase,
} from "../lib/buildin/client"
import { syncPlaylistToBuildin } from "../lib/buildin/adapters/ops-mirrors"
import { getExternalId } from "../lib/buildin/outbox"
import {
  earliestHistoryDatesByPlacementKey,
  playlistPlacementKey,
  syncPlacementsForArtistPlaylist,
  trackTitleFromParsed,
} from "../lib/playlist-placements"
import type { ParsedTrack } from "../lib/sftp-playlist-parser"
import { mskDateString } from "../lib/msk-date"

const dryRun = process.argv.includes("--dry-run")
const cleanupSchema = process.argv.includes("--cleanup-schema")
const archiveLegacy = process.argv.includes("--archive-legacy")

const LEGACY_PROP_NAMES = [
  "Local ID",
  "Platform",
  "Artist ID",
  "First Seen",
  "Last Seen",
  "Cover",
  "АртистRel",
  "Название",
]

async function ensureSlimSchema(dbId: string) {
  const db = await buildinGetDatabase(dbId)
  const props = (db.properties || {}) as Record<
    string,
    { id?: string; name?: string; type?: string }
  >
  const byName = new Map(
    Object.values(props).map((p) => [p.name || "", p] as const)
  )

  const mutations: Record<string, unknown> = {}

  // Rename title Название → Трек if needed
  const titleProp =
    byName.get("Трек") ||
    byName.get("Название") ||
    Object.values(props).find((p) => p.type === "title")
  if (titleProp?.id && titleProp.name !== "Трек") {
    mutations[titleProp.id] = {
      id: titleProp.id,
      name: "Трек",
      type: "title",
      title: {},
    }
  } else if (!byName.get("Трек")) {
    mutations["Трек"] = { name: "Трек", type: "title", title: {} }
  }

  if (!byName.get("Артист")) {
    mutations["Артист"] = { name: "Артист", type: "rich_text", rich_text: {} }
  }
  if (!byName.get("Плейлист")) {
    mutations["Плейлист"] = {
      name: "Плейлист",
      type: "rich_text",
      rich_text: {},
    }
  }
  if (!byName.get("URL")) {
    mutations["URL"] = { name: "URL", type: "url", url: {} }
  }
  if (!byName.get("Впервые обнаружен")) {
    mutations["Впервые обнаружен"] = {
      name: "Впервые обнаружен",
      type: "date",
      date: {},
    }
  }

  if (Object.keys(mutations).length === 0) {
    console.log("Schema already has slim target properties")
    return
  }

  console.log("Mutating schema (add/rename):", Object.keys(mutations))
  if (dryRun) return

  try {
    await buildinMutateDatabase(
      dbId,
      { properties: mutations },
      `playlist-placements-schema-${Date.now()}`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Production token may lack /mutate; apply schema via Cursor MCP instead.
    console.warn("Schema mutate via REST failed (continue data sync):", msg)
  }
}

async function removeLegacyProperties(dbId: string) {
  const db = await buildinGetDatabase(dbId)
  const props = (db.properties || {}) as Record<
    string,
    { id?: string; name?: string; type?: string }
  >
  const mutations: Record<string, null> = {}
  for (const p of Object.values(props)) {
    if (p.name && LEGACY_PROP_NAMES.includes(p.name) && p.id) {
      // Don't delete title if somehow still named Название and Трек missing
      if (p.name === "Название" && p.type === "title") continue
      mutations[p.id] = null
    }
  }
  if (Object.keys(mutations).length === 0) {
    console.log("No legacy properties to remove")
    return
  }
  console.log("Removing legacy properties:", Object.keys(mutations).length)
  if (dryRun) return
  await buildinMutateDatabase(
    dbId,
    { properties: mutations },
    `playlist-placements-cleanup-${Date.now()}`
  )
}

async function main() {
  if (!getBuildinApiToken()) {
    console.error("BUILDIN_API_TOKEN missing")
    process.exit(2)
  }

  const dbId = requireBuildinDatabaseId("playlists")
  const reportDir = resolve(process.cwd(), ".tmp/buildin-checkpoint")
  mkdirSync(reportDir, { recursive: true })

  console.log(
    JSON.stringify(
      { dryRun, cleanupSchema, archiveLegacy, dbId },
      null,
      2
    )
  )

  await ensureSlimSchema(dbId)

  const seedDates = await earliestHistoryDatesByPlacementKey()
  const playlists = await prisma.playlist.findMany()
  const today = mskDateString()

  const report = {
    playlistsScanned: playlists.length,
    placementsUpserted: 0,
    placementsUnchanged: 0,
    placementsDeactivated: 0,
    buildinSynced: 0,
    buildinFailed: 0,
    legacyArchived: 0,
    errors: [] as string[],
  }

  for (const pl of playlists) {
    const tracks = (pl.trackData as unknown as ParsedTrack[]) || []
    // Seed map: also include row firstSeenDate for keys without history
    const seed = new Map(seedDates)
    for (const track of tracks) {
      const title = trackTitleFromParsed(track)
      const key = playlistPlacementKey({
        playlistUrl: pl.playlistUrl,
        isrc: track.isrc,
        artistName: track.artistName || pl.artistName,
        trackTitle: title,
      })
      if (!seed.has(key) && pl.firstSeenDate) {
        seed.set(key, pl.firstSeenDate)
      }
    }

    if (dryRun) {
      const keys = new Set<string>()
      for (const track of tracks) {
        const title = trackTitleFromParsed(track)
        keys.add(
          playlistPlacementKey({
            playlistUrl: pl.playlistUrl,
            isrc: track.isrc,
            artistName: track.artistName || pl.artistName,
            trackTitle: title,
          })
        )
      }
      report.placementsUpserted += keys.size
      continue
    }

    const { upserted, deactivated } = await syncPlacementsForArtistPlaylist({
      playlistUrl: pl.playlistUrl,
      playlistName: pl.playlistName,
      platform: pl.platform,
      artistName: pl.artistName,
      artistId: pl.artistId,
      playlistRowId: pl.id,
      tracks,
      today,
      playlistFirstSeenDate: pl.firstSeenDate,
      seedFirstSeenByKey: seed,
    })

    for (const p of upserted) {
      if (p.changed) report.placementsUpserted++
      else report.placementsUnchanged++
      try {
        await syncPlaylistToBuildin({
          id: p.placementKey,
          trackTitle: p.trackTitle,
          artistName: p.artistName,
          playlistName: p.playlistName,
          playlistUrl: p.playlistUrl,
          firstSeenDate: p.firstSeenDate,
        })
        report.buildinSynced++
      } catch (err) {
        report.buildinFailed++
        report.errors.push(
          `${p.placementKey}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    for (const p of deactivated) {
      report.placementsDeactivated++
      try {
        await syncPlaylistToBuildin({
          id: p.placementKey,
          trackTitle: p.trackTitle,
          artistName: p.artistName,
          playlistName: p.playlistName,
          playlistUrl: p.playlistUrl,
          firstSeenDate: p.firstSeenDate,
          archived: true,
        })
        report.buildinSynced++
      } catch (err) {
        report.buildinFailed++
        report.errors.push(
          `archive ${p.placementKey}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  }

  if (archiveLegacy && !dryRun) {
    const legacy = await prisma.buildinExternalId.findMany({
      where: { entityType: "playlist" },
    })
    for (const row of legacy) {
      // Skip if this localId is already a placement key mapping
      const asPlacement = await getExternalId("playlist_placement", row.localId)
      if (asPlacement) {
        await prisma.buildinExternalId.delete({ where: { id: row.id } })
        continue
      }
      try {
        await buildinUpdatePage(row.buildinPageId, { in_trash: true })
        await prisma.buildinExternalId.delete({ where: { id: row.id } })
        report.legacyArchived++
      } catch (err) {
        report.errors.push(
          `legacy ${row.localId}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  }

  if (cleanupSchema) {
    await removeLegacyProperties(dbId)
  }

  const outPath = resolve(
    reportDir,
    `playlist-placements-${dryRun ? "dry-run" : "live"}.json`
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log("Wrote", outPath)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
