/**
 * Проставляет coverUrl для плейлистов VK Музыки в БД (audio.getPlaylistById через VK_PLAYLIST_COVER_ACCESS_TOKEN).
 *
 * Требуется DATABASE_URL + VK_PLAYLIST_COVER_ACCESS_TOKEN (.env / .env.local).
 *
 * Запуск:
 *   pnpm run db:backfill-vk-covers
 *   pnpm run db:backfill-vk-covers -- --dry-run --limit=5
 *   pnpm run db:backfill-vk-covers -- --force   # перезаписать даже если coverUrl уже есть
 */

import "dotenv/config"
import fs from "fs"
import path from "path"

// dotenv/config загружает только .env; .env.local нужен отдельно
;(function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, "utf8")
  for (const line of text.split("\n")) {
    const s = line.trim()
    if (!s || s.startsWith("#")) continue
    const eq = s.indexOf("=")
    if (eq <= 0) continue
    const key = s.slice(0, eq).trim()
    let val = s.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
})()

process.env.SKIP_COVER_SCRAPER_DELAY = "1"

import { prisma } from "../lib/prisma"
import {
  parseVkMusicPlaylistIdsFromUrl,
  scrapeVkPlaylistCover,
} from "../lib/playlist-cover-scraper"

function parseArgs() {
  const argv = process.argv.slice(2)
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    limit: (() => {
      const a = argv.find((x) => x.startsWith("--limit="))
      if (!a) return undefined
      const n = parseInt(a.split("=")[1] || "", 10)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
  }
}

async function main() {
  const { dryRun, force, limit } = parseArgs()

  if (!process.env.DATABASE_URL) {
    console.error("Нет DATABASE_URL. Укажите в .env или .env.local")
    process.exit(1)
  }

  const token = process.env.VK_PLAYLIST_COVER_ACCESS_TOKEN?.trim()
  if (!token) {
    console.error("Нет VK_PLAYLIST_COVER_ACCESS_TOKEN. Укажите в .env.local")
    console.error(
      "Получить токен: https://oauth.vk.com/authorize?client_id=2685278&scope=audio,offline&redirect_uri=https://oauth.vk.com/blank.html&response_type=token&v=5.199"
    )
    process.exit(1)
  }

  console.log(`Токен: задан (${token.length} символов)`)

  const where = {
    AND: [
      {
        OR: [
          { platform: { contains: "vk", mode: "insensitive" as const } },
          { platform: { contains: "вк", mode: "insensitive" as const } },
        ],
      },
      ...(force ? [] : [{ coverUrl: null }]),
    ],
  }

  const rows = await prisma.playlist.findMany({
    where,
    select: {
      id: true,
      playlistUrl: true,
      playlistName: true,
      platform: true,
      coverUrl: true,
    },
    orderBy: { updatedAt: "desc" },
    ...(limit !== undefined ? { take: limit } : {}),
  })

  console.log(
    `\nНайдено плейлистов VK: ${rows.length}${force ? " (--force: в т.ч. с обложкой)" : " (только без coverUrl)"}${dryRun ? " [DRY-RUN]" : ""}\n`
  )

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const prefix = `[${i + 1}/${rows.length}]`

    if (!parseVkMusicPlaylistIdsFromUrl(row.playlistUrl)) {
      console.warn(`${prefix} Пропуск — URL не парсится как /music/playlist/ownerId_id: ${row.playlistUrl}`)
      skipped++
      continue
    }

    console.log(`${prefix} "${row.playlistName}"`)
    console.log(`       URL: ${row.playlistUrl}`)

    const cover = await scrapeVkPlaylistCover(row.playlistUrl)

    if (!cover) {
      console.warn(`${prefix} Нет обложки`)
      failed++
      continue
    }

    if (dryRun) {
      console.log(`${prefix} DRY-RUN: coverUrl=${cover.slice(0, 80)}…`)
      updated++
    } else {
      await prisma.playlist.update({
        where: { id: row.id },
        data: { coverUrl: cover, coverFetchedAt: new Date() },
      })
      console.log(`${prefix} ✅ coverUrl обновлён: ${cover.slice(0, 80)}…`)
      updated++
    }
  }

  console.log("\n── Итог ──")
  console.log(`Обновлено:   ${updated}`)
  console.log(`Пропущено:   ${skipped}`)
  console.log(`Без обложки: ${failed}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
