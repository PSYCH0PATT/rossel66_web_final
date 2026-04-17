/**
 * Проверка парсеров обложек VK / Яндекс.
 *
 * Юнит-часть (URL + JSON) — всегда локально.
 * Живые запросы — при доступной сети до vk.com / music.yandex.net.
 *
 * Запуск:
 *   SKIP_COVER_SCRAPER_DELAY=1 npx tsx scripts/verify-playlist-cover-scrapers.ts
 *
 * Отдельно проверить VK-токен (audio.getPlaylistById):
 *   pnpm run verify:vk-playlist-token
 */

import {
  extractYandexCoverUrl,
  normalizeYandexImageUrl,
  parseVkMusicPlaylistIdsFromUrl,
  parseYandexPlaylistUrl,
  scrapeVkPlaylistCover,
  scrapeYandexPlaylistCover,
} from "../lib/playlist-cover-scraper"

let failed = 0
function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failed++
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    console.log(`ok  ${name}`)
  }
}

function unitVkPlaylistUrl() {
  const a = parseVkMusicPlaylistIdsFromUrl("https://vk.com/music/playlist/-147845620_456240019")
  assert("vk parse owner+id", a?.ownerId === "-147845620" && a?.playlistId === "456240019", JSON.stringify(a))
  const b = parseVkMusicPlaylistIdsFromUrl("https://m.vk.com/music/playlist/123_999")
  assert("vk parse positive owner", b?.ownerId === "123" && b?.playlistId === "999", JSON.stringify(b))
  assert("vk parse invalid", parseVkMusicPlaylistIdsFromUrl("https://yandex.ru/foo") === null)
}

function unitYandexUrl() {
  assert(
    "parse yandex.ru",
    parseYandexPlaylistUrl("https://music.yandex.ru/users/foo/playlists/123")?.owner === "foo" &&
      parseYandexPlaylistUrl("https://music.yandex.ru/users/foo/playlists/123")?.kind === "123"
  )
  const yc = parseYandexPlaylistUrl("https://music.yandex.com/ru/users/bar/playlists/999")
  assert(
    "parse yandex.com + locale",
    yc?.owner === "bar" && yc?.kind === "999" && yc?.tld === "com",
    JSON.stringify(yc)
  )
  assert(
    "parse yandex.ru tld",
    parseYandexPlaylistUrl("https://music.yandex.ru/users/foo/playlists/123")?.tld === "ru",
    ""
  )
  assert("parse invalid", parseYandexPlaylistUrl("https://vk.com/foo") === null)

  const coverUri = extractYandexCoverUrl({
    playlist: {
      cover: { uri: "avatars.yandex.net/get-music-user-playlist/xxx/%%" },
    },
  })
  assert("extract playlist.cover.uri", !!coverUri && coverUri.includes("400x400"), coverUri ?? "")

  const og = extractYandexCoverUrl({
    playlists: [
      { ogImage: "avatars.yandex.net/get-music-user-playlist/abc/def/orig" },
    ],
  })
  assert(
    "extract playlists[0].ogImage",
    !!og && og.startsWith("https://") && og.includes("avatars.yandex.net"),
    og ?? ""
  )

  const mobile = extractYandexCoverUrl({
    result: {
      ogImage: "avatars.yandex.net/get-music-misc/xxx/%%",
    },
  })
  assert("extract mobile result.ogImage", !!mobile && mobile.includes("400x400"), mobile ?? "")

  const mosaic = extractYandexCoverUrl({
    result: {
      cover: {
        type: "mosaic",
        itemsUri: ["avatars.yandex.net/get-music-user-playlist/a/b/%%"],
      },
    },
  })
  assert("extract mosaic cover.itemsUri[0]", !!mosaic && mosaic.includes("400x400"), mosaic ?? "")

  assert(
    "normalize %%",
    normalizeYandexImageUrl("https://avatars.yandex.net/x/%%").endsWith("400x400")
  )
}

async function liveYandex() {
  const url = "https://music.yandex.ru/users/yamusic/playlists/1003"
  const out = await scrapeYandexPlaylistCover(url)
  if (out) {
    console.log(`live Yandex cover: ${out}`)
    assert("live yandex non-null", out.startsWith("http"))
  } else {
    console.warn("live Yandex: null (сеть, 403, смена API или блокировка)")
  }
}

async function liveVk() {
  // Публичный плейлист VK может меняться; при 404/null это ожидаемо для smoke
  const url = "https://vk.com/music/playlist/-147845620_456240019"
  const out = await scrapeVkPlaylistCover(url)
  if (out) {
    console.log(`live VK cover: ${out}`)
    assert("live vk non-null", out.startsWith("http"))
  } else {
    console.warn(
      "live VK: null — на странице плейлиста нет SSR-обложки; задайте VK_PLAYLIST_COVER_ACCESS_TOKEN и повторите (audio.getPlaylistById)"
    )
  }
}

async function main() {
  console.log("=== Unit: VK playlist URL ===")
  unitVkPlaylistUrl()

  console.log("=== Unit: Yandex URL / JSON ===")
  unitYandexUrl()

  console.log("\n=== Live (optional) ===")
  await liveYandex()
  await liveVk()

  if (failed) {
    console.error(`\nГотово с ошибками: ${failed}`)
    process.exit(1)
  }
  console.log("\nГотово без ошибок юнит-тестов.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
