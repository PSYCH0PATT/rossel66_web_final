/**
 * Backfill Playlist / PlaylistTrackPlacement firstSeenDate to earliest known signal.
 *
 * Signals (min of):
 *   - current firstSeenDate
 *   - parent Playlist.firstSeenDate (url + artist)
 *   - earliest PlaylistHistory changeDate for the placement key
 *
 * Usage:
 *   npx tsx scripts/backfill-playlist-first-seen.ts --dry-run
 *   npx tsx scripts/backfill-playlist-first-seen.ts
 *   npx tsx scripts/backfill-playlist-first-seen.ts --sync-buildin
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
  earliestHistoryDatesByPlacementKey,
  earliestObservationDate,
  parseObservationDate,
  playlistPlacementKey,
} from "../lib/playlist-placements"
import type { ParsedTrack } from "../lib/sftp-playlist-parser"

const dryRun = process.argv.includes("--dry-run")
const syncBuildin = process.argv.includes("--sync-buildin")

async function main() {
  console.log(
    `[backfill-first-seen] dryRun=${dryRun} syncBuildin=${syncBuildin}`
  )

  const historyByKey = await earliestHistoryDatesByPlacementKey()
  const playlists = await prisma.playlist.findMany({
    select: {
      id: true,
      playlistUrl: true,
      artistName: true,
      firstSeenDate: true,
      trackData: true,
    },
  })

  // url+artist → earliest playlist firstSeen (and any track parsedDate still in JSON)
  const playlistFirstByPair = new Map<string, string>()
  for (const pl of playlists) {
    const pair = `${pl.playlistUrl}\0${pl.artistName}`
    const trackDates = ((pl.trackData as unknown as ParsedTrack[]) || []).map(
      (t) => t?.parsedDate
    )
    const earliest =
      earliestObservationDate(pl.firstSeenDate, ...trackDates) || null
    if (!earliest) continue
    const prev = playlistFirstByPair.get(pair)
    if (!prev || earliest < prev) playlistFirstByPair.set(pair, earliest)
  }

  const placements = await prisma.playlistTrackPlacement.findMany()
  let placementUpdated = 0
  const changedForBuildin: Array<{
    placementKey: string
    trackTitle: string
    artistName: string
    playlistName: string
    playlistUrl: string
    firstSeenDate: string
  }> = []

  for (const p of placements) {
    const pair = `${p.playlistUrl}\0${p.artistName}`
    const titleKey = playlistPlacementKey({
      playlistUrl: p.playlistUrl,
      artistName: p.artistName,
      trackTitle: p.trackTitle,
    })
    const next =
      earliestObservationDate(
        p.firstSeenDate,
        playlistFirstByPair.get(pair),
        historyByKey.get(p.placementKey),
        historyByKey.get(titleKey)
      ) || p.firstSeenDate

    if (next === p.firstSeenDate) continue

    placementUpdated++
    console.log(
      `placement ${p.placementKey}: ${p.firstSeenDate} → ${next}`
    )
    if (!dryRun) {
      await prisma.playlistTrackPlacement.update({
        where: { id: p.id },
        data: { firstSeenDate: next },
      })
    }
    changedForBuildin.push({
      placementKey: p.placementKey,
      trackTitle: p.trackTitle,
      artistName: p.artistName,
      playlistName: p.playlistName,
      playlistUrl: p.playlistUrl,
      firstSeenDate: next,
    })
  }

  // Also pull placement ages back onto Playlist rows when placements are older
  let playlistUpdated = 0
  for (const pl of playlists) {
    const pair = `${pl.playlistUrl}\0${pl.artistName}`
    const related = placements.filter(
      (p) => p.playlistUrl === pl.playlistUrl && p.artistName === pl.artistName
    )
    const trackDates = ((pl.trackData as unknown as ParsedTrack[]) || []).map(
      (t) => t?.parsedDate
    )
    // After placement updates, prefer the computed next dates for related rows
    const relatedDates = related.map((p) => {
      const changed = changedForBuildin.find(
        (c) => c.placementKey === p.placementKey
      )
      return changed?.firstSeenDate ?? p.firstSeenDate
    })
    const next =
      earliestObservationDate(
        pl.firstSeenDate,
        playlistFirstByPair.get(pair),
        ...relatedDates,
        ...trackDates
      ) || parseObservationDate(pl.firstSeenDate)

    if (!next || next === pl.firstSeenDate) continue
    playlistUpdated++
    console.log(
      `playlist ${pl.artistName} @ ${pl.playlistUrl}: ${pl.firstSeenDate} → ${next}`
    )
    if (!dryRun) {
      await prisma.playlist.update({
        where: { id: pl.id },
        data: { firstSeenDate: next },
      })
    }
  }

  if (syncBuildin && !dryRun && changedForBuildin.length > 0) {
    const { enqueuePlaylistSync } = await import("../lib/buildin/sync-hooks")
    for (const p of changedForBuildin) {
      await enqueuePlaylistSync({
        id: p.placementKey,
        trackTitle: p.trackTitle,
        artistName: p.artistName,
        playlistName: p.playlistName,
        playlistUrl: p.playlistUrl,
        firstSeenDate: p.firstSeenDate,
      })
    }
    console.log(`enqueued ${changedForBuildin.length} Buildin sync events`)
  } else if (syncBuildin && dryRun) {
    console.log(
      `[dry-run] would enqueue ${changedForBuildin.length} Buildin sync events`
    )
  }

  console.log({
    placementsChecked: placements.length,
    placementUpdated,
    playlistsChecked: playlists.length,
    playlistUpdated,
    historyKeys: historyByKey.size,
  })

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
