#!/usr/bin/env tsx
/**
 * Отчёт по ссылкам artistId на несуществующих пользователей.
 * Политика: вручную поправить данные или обнулить artistId (см. вывод).
 *
 * Usage: pnpm exec tsx scripts/find-orphans.ts
 */

// @ts-ignore
if (typeof process.loadEnvFile === 'function') {
  // @ts-ignore
  process.loadEnvFile('.env')
}

import { prisma } from "../lib/prisma"

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } })
  const valid = new Set(users.map((u) => u.id))

  const releases = await prisma.release.findMany({
    where: { artistId: { not: null } },
    select: { id: true, artistId: true, title: true },
  })
  const relOrphans = releases.filter((r) => r.artistId && !valid.has(r.artistId))

  const reports = await prisma.report.findMany({
    where: { artistId: { not: null } },
    select: { id: true, artistId: true, artistName: true },
  })
  const repOrphans = reports.filter((r) => r.artistId && !valid.has(r.artistId))

  const playlists = await prisma.playlist.findMany({
    where: { artistId: { not: null } },
    select: { id: true, artistId: true, playlistName: true },
  })
  const plOrphans = playlists.filter((p) => p.artistId && !valid.has(p.artistId))

  const streams = await prisma.streamAnalytics.findMany({
    where: { artistId: { not: null } },
    select: { id: true, artistId: true },
  })
  const stOrphans = streams.filter((s) => s.artistId && !valid.has(s.artistId))

  console.log("=== Orphan artistId report ===")
  console.log(`Release rows with missing User: ${relOrphans.length}`)
  if (relOrphans.length) console.log(relOrphans.slice(0, 20))
  console.log(`Report rows with missing User: ${repOrphans.length}`)
  if (repOrphans.length) console.log(repOrphans.slice(0, 20))
  console.log(`Playlist rows with missing User: ${plOrphans.length}`)
  if (plOrphans.length) console.log(plOrphans.slice(0, 20))
  console.log(`StreamAnalytics rows with missing User: ${stOrphans.length}`)
  if (stOrphans.length) console.log(stOrphans.slice(0, 20))
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
