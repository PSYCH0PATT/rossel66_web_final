/**
 * Проверка, подходит ли значение для VK_PLAYLIST_COVER_ACCESS_TOKEN
 * (тот же вызов audio.getPlaylistById, что в lib/playlist-cover-scraper.ts).
 *
 * Защищённый ключ приложения — НЕ access_token.
 * Сервисный ключ доступа — иногда подходит как access_token, но audio.* может требовать пользовательский токен.
 *
 * Запуск (подхватит .env.local из корня проекта, если переменная ещё не в окружении):
 *   npx tsx scripts/test-vk-playlist-cover-token.ts
 *   npx tsx scripts/test-vk-playlist-cover-token.ts "https://vk.com/music/playlist/-123_456"
 */

import fs from "fs"
import path from "path"
import {
  probeVkPlaylistCoverApi,
  vkPlaylistCoverProbeHint,
} from "../lib/playlist-cover-scraper"

const DEFAULT_PLAYLIST = "https://vk.com/music/playlist/-147845620_456240019"

function loadEnvLocalIfNeeded() {
  if (process.env.VK_PLAYLIST_COVER_ACCESS_TOKEN?.trim()) return
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
}

async function main() {
  loadEnvLocalIfNeeded()
  const token = process.env.VK_PLAYLIST_COVER_ACCESS_TOKEN?.trim()
  const playlistUrl = (process.argv[2] || DEFAULT_PLAYLIST).trim()

  console.log("=== VK playlist cover token probe ===\n")
  console.log(`Playlist URL: ${playlistUrl}`)

  if (!token) {
    console.log(`
Нет VK_PLAYLIST_COVER_ACCESS_TOKEN в окружении и в .env.local.

Добавьте в .env.local строку (без кавычек или в кавычках):
  VK_PLAYLIST_COVER_ACCESS_TOKEN=<сервисный ключ ИЛИ пользовательский access_token>

Повторите:
  npx tsx scripts/test-vk-playlist-cover-token.ts
`)
    process.exit(2)
  }

  console.log(`Токен: задан (${token.length} символов), значение не выводим.\n`)

  const r = await probeVkPlaylistCoverApi(playlistUrl, token)

  if (r.ok) {
    console.log("Результат: OK — этот токен подходит для audio.getPlaylistById + обложки.")
    console.log(`owner_id=${r.ownerId} playlist_id=${r.playlistId}`)
    console.log(`coverUrl (первые 80 символов): ${r.coverUrl.slice(0, 80)}…`)
    console.log("\nМожно использовать этот же токен в VK_PLAYLIST_COVER_ACCESS_TOKEN на проде.")
    process.exit(0)
  }

  console.log("Результат: НЕ подошёл для обложки через API.\n")

  switch (r.kind) {
    case "bad_playlist_url":
      console.log("URL не похож на …/music/playlist/{owner_id}_{playlist_id}")
      break
    case "fetch_error":
      console.log(`Сеть / таймаут: ${r.message}`)
      break
    case "http":
      console.log(`HTTP ${r.status} от api.vk.com`)
      break
    case "invalid_json":
      console.log("Ответ VK не JSON")
      break
    case "vk_error":
      console.log(`VK API error_code=${r.code}`)
      console.log(`VK API error_msg: ${r.message}`)
      console.log(`\nПодсказка: ${vkPlaylistCoverProbeHint(r.code)}`)
      break
    case "empty_response":
      console.log("В ответе нет поля response")
      break
    case "no_photo":
      console.log(
        "Ответ OK, но в плейлисте нет photo / sizes — другой плейлист или тип плейлиста без обложки."
      )
      break
  }

  console.log(`
Что пробовать дальше:
  • Если подставляли «защищённый ключ» — это не то; нужен access_token (сервисный ключ из настроек приложения или пользовательский после OAuth).
  • Если сервисный ключ даёт error 15 / про audio — выпустите пользовательский токен с доступом к аудиозаписями (scope audio) для того же приложения.
`)
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
