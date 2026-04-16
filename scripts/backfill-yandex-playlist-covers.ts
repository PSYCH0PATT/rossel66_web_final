/**
 * Проставляет coverUrl для плейлистов Яндекс Музыки в БД (api.music.yandex.net + фолбэки).
 *
 * Требуется DATABASE_URL (.env / .env.local).
 * Рекомендуется: SKIP_COVER_SCRAPER_DELAY=1 (уже в npm-скрипте).
 * Опционально: YANDEX_MUSIC_OAUTH_TOKEN — OAuth-токен Яндекс Музыки (при 401 на мобильном API).
 *
 * Запуск:
 *   pnpm run db:backfill-yandex-covers
 *   pnpm run db:backfill-yandex-covers -- --dry-run --limit=5
 *   pnpm run db:backfill-yandex-covers -- --force   # перезаписать даже если coverUrl уже есть
 *   pnpm run db:backfill-yandex-covers -- --skip-preflight
 */

import "dotenv/config"

process.env.SKIP_COVER_SCRAPER_DELAY = "1"

import { prisma } from "../lib/prisma"
import {
  parseYandexPlaylistUrl,
  preflightYandexMusicApi,
  scrapeYandexPlaylistCover,
} from "../lib/playlist-cover-scraper"

function parseArgs() {
  const argv = process.argv.slice(2)
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    skipPreflight: argv.includes("--skip-preflight"),
    limit: (() => {
      const a = argv.find((x) => x.startsWith("--limit="))
      if (!a) return undefined
      const n = parseInt(a.split("=")[1] || "", 10)
      return Number.isFinite(n) && n > 0 ? n : undefined
    })(),
  }
}

async function main() {
  const { dryRun, force, limit, skipPreflight } = parseArgs()

  if (!process.env.DATABASE_URL) {
    console.error("Нет DATABASE_URL. Укажите в .env или .env.local")
    process.exit(1)
  }

  if (!skipPreflight) {
    console.log("Preflight: api.music.yandex.net (yandexmusic/1217)…")
    const pf = await preflightYandexMusicApi()
    if (pf.ok) {
      console.log(`Preflight OK — ${pf.message}\n`)
    } else {
      console.warn(
        `Preflight не прошёл (${pf.httpStatus ?? "—"}): ${pf.message}\n` +
          "Бэкфилл всё равно продолжится (фолбэки). При постоянных 401 задайте YANDEX_MUSIC_OAUTH_TOKEN.\n"
      )
    }
  }

  const where = {
    AND: [
      {
        OR: [
          { platform: { contains: "яндекс", mode: "insensitive" as const } },
          { platform: { contains: "yandex", mode: "insensitive" as const } },
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
    `Найдено плейлистов Яндекса: ${rows.length}${force ? " (режим --force: в т.ч. с обложкой)" : " (только без coverUrl)"}${dryRun ? " [DRY-RUN]" : ""}\n`
  )

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const prefix = `[${i + 1}/${rows.length}]`

    if (!parseYandexPlaylistUrl(row.playlistUrl)) {
      console.warn(`${prefix} Пропуск — URL не похож на users/.../playlists/id: ${row.playlistUrl}`)
      skipped++
      continue
    }

    console.log(`${prefix} ${row.playlistName} → ${row.playlistUrl}`)
    const cover = await scrapeYandexPlaylistCover(row.playlistUrl)

    if (!cover) {
      console.warn(`${prefix} Нет обложки (API/null)`)
      failed++
      await new Promise((r) => setTimeout(r, 400))
      continue
    }

    if (dryRun) {
      console.log(`${prefix} DRY-RUN: было бы coverUrl=${cover.slice(0, 80)}…`)
      updated++
    } else {
      await prisma.playlist.update({
        where: { id: row.id },
        data: { coverUrl: cover, coverFetchedAt: new Date() },
      })
      console.log(`${prefix} OK coverUrl обновлён`)
      updated++
    }

    // небольшая пауза между запросами к Яндексу
    await new Promise((r) => setTimeout(r, 350))
  }

  console.log("\n── Итог ──")
  console.log(`Обновлено (успех): ${updated}`)
  console.log(`Пропуск URL:     ${skipped}`)
  console.log(`Без обложки:     ${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
