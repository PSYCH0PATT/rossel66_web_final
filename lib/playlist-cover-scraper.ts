/**
 * Playlist cover scraper — VK Music & Yandex Music
 *
 * VK:
 *   1) Если задан `VK_PLAYLIST_COVER_ACCESS_TOKEN` — `audio.getPlaylistById` (обложка из `photo.sizes`).
 *      Страница vk.com/music/playlist/… — SPA без SSR-обложки в HTML; без токена сеть VK не отдаёт JSON плейлиста.
 *   2) Иначе — fetch HTML + cheerio (редкие старые/особые страницы с og:image или блоком обложки).
 * Yandex: mobile API api.music.yandex.net (primary), handlers on music.yandex.ru, HTML fallback.
 *
 * Anti-detection:
 *  - Random User-Agent from curated pool
 *  - Random delays 3–8 s between requests
 *  - Russian Accept-Language + Referer
 *  - One retry with doubled delay on transient errors
 *  - Abort on 403/429 (returns null immediately)
 */

import * as cheerio from 'cheerio'

const LOG_PREFIX_VK = '[CoverScraper:VK]'
const LOG_PREFIX_YA = '[CoverScraper:Yandex]'

// ─── User-Agent pool ────────────────────────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/** Random delay between minMs and maxMs */
function randomDelay(minMs = 3000, maxMs = 8000): Promise<void> {
  if (process.env.SKIP_COVER_SCRAPER_DELAY === "1") {
    return Promise.resolve()
  }
  const ms = minMs + Math.random() * (maxMs - minMs)
  console.log(`  ⏱  waiting ${Math.round(ms)}ms…`)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── VK Music ───────────────────────────────────────────────────────────────

/** owner_id и id плейлиста из URL вида …/music/playlist/-2000123_456789 */
export function parseVkMusicPlaylistIdsFromUrl(playlistUrl: string): {
  ownerId: string
  playlistId: string
} | null {
  const m = playlistUrl.match(/\/music\/playlist\/(-?\d+)_(\d+)/i)
  if (!m) return null
  return { ownerId: m[1], playlistId: m[2] }
}

function pickBestVkPhotoUrl(photo: Record<string, unknown> | null | undefined): string | null {
  if (!photo || typeof photo !== "object") return null
  const sizes = photo["sizes"] as Array<{ url?: string; width?: number; height?: number }> | undefined
  if (Array.isArray(sizes) && sizes.length > 0) {
    const withUrl = sizes.filter((s) => s && typeof s.url === "string" && s.url.length > 0)
    if (withUrl.length === 0) return null
    withUrl.sort((a, b) => {
      const ar = (a.width || 0) * (a.height || 0)
      const br = (b.width || 0) * (b.height || 0)
      return br - ar
    })
    return withUrl[0]!.url!
  }
  const thumbs = photo["thumbs"] as unknown
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const last = thumbs[thumbs.length - 1]
    if (typeof last === "string" && last.startsWith("http")) return last
    if (last && typeof last === "object" && typeof (last as { url?: string }).url === "string") {
      return (last as { url: string }).url
    }
  }
  const url = photo["url"] as string | undefined
  if (url && url.startsWith("http")) return url
  return null
}

/**
 * Обложка через официальный VK API (нужен токен с доступом к audio, например пользовательский).
 * Токен не логируем.
 */
async function fetchVkPlaylistCoverViaApi(playlistUrl: string, accessToken: string): Promise<string | null> {
  const ids = parseVkMusicPlaylistIdsFromUrl(playlistUrl)
  if (!ids) {
    console.warn(`${LOG_PREFIX_VK} API: не удалось разобрать owner_id / playlist_id из URL`)
    return null
  }

  const params = new URLSearchParams({
    access_token: accessToken,
    owner_id: ids.ownerId,
    playlist_id: ids.playlistId,
    v: "5.199",
  })

  const apiUrl = `https://api.vk.com/method/audio.getPlaylistById?${params.toString()}`
  console.log(
    `${LOG_PREFIX_VK} API: audio.getPlaylistById owner_id=${ids.ownerId} playlist_id=${ids.playlistId}`
  )

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetch(apiUrl, { signal: controller.signal })
  } catch (e) {
    clearTimeout(t)
    console.error(`${LOG_PREFIX_VK} API: fetch error`, e)
    return null
  }
  clearTimeout(t)

  if (!res.ok) {
    console.warn(`${LOG_PREFIX_VK} API: HTTP ${res.status}`)
    return null
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    console.error(`${LOG_PREFIX_VK} API: ответ не JSON`)
    return null
  }

  const root = json as Record<string, unknown>
  if (root["error"]) {
    const err = root["error"] as Record<string, unknown>
    console.warn(
      `${LOG_PREFIX_VK} API: error ${err["error_code"]} — ${err["error_msg"]} (проверьте scope audio и токен)`
    )
    return null
  }

  const response = root["response"] as Record<string, unknown> | undefined
  if (!response) return null

  const playlist = (response["playlist"] as Record<string, unknown> | undefined) ?? response
  const photo = playlist["photo"] as Record<string, unknown> | undefined
  const url = pickBestVkPhotoUrl(photo)
  if (url) {
    console.log(`${LOG_PREFIX_VK} API: ✅ обложка из photo`)
    return url
  }

  console.warn(`${LOG_PREFIX_VK} API: в ответе нет photo / sizes`)
  return null
}

/**
 * Fetches the actual cover image URL from a VK Music playlist page.
 *
 * При наличии `VK_PLAYLIST_COVER_ACCESS_TOKEN` сначала вызывается API.
 * Иначе — разбор HTML (редкие SSR-страницы).
 *
 * Returns null if the cover cannot be extracted or on hard errors (403/429).
 */
export async function scrapeVkPlaylistCover(playlistUrl: string): Promise<string | null> {
  console.log(`${LOG_PREFIX_VK} Starting scrape for: ${playlistUrl}`)

  const token = process.env.VK_PLAYLIST_COVER_ACCESS_TOKEN?.trim()
  if (token) {
    const fromApi = await fetchVkPlaylistCoverViaApi(playlistUrl, token)
    if (fromApi) return fromApi
    console.warn(`${LOG_PREFIX_VK} API не вернул обложку — fallback на HTML`)
  }

  const attempt = async (delayOnRetry: number): Promise<string | null> => {
    const ua = randomUA()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    console.log(`${LOG_PREFIX_VK} Fetching URL with UA: ${ua.substring(0, 60)}…`)

    let res: Response
    try {
      res = await fetch(playlistUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://vk.com/',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
      })
    } catch (err) {
      clearTimeout(timeout)
      const msg = (err as Error).message || String(err)
      if (msg.includes('abort') || msg.includes('timeout')) {
        console.error(`${LOG_PREFIX_VK} ERROR: Request timed out`)
      } else {
        console.error(`${LOG_PREFIX_VK} ERROR: Fetch failed — ${msg}`)
      }
      return null
    }

    clearTimeout(timeout)
    console.log(`${LOG_PREFIX_VK} HTTP ${res.status} ${res.statusText}`)

    if (res.status === 403 || res.status === 429) {
      console.error(`${LOG_PREFIX_VK} BLOCKED: ${res.status} — stopping immediately`)
      return null
    }

    if (!res.ok) {
      console.warn(`${LOG_PREFIX_VK} Non-OK status ${res.status}; ${delayOnRetry > 0 ? 'will retry' : 'giving up'}`)
      if (delayOnRetry > 0) {
        await new Promise((r) => setTimeout(r, delayOnRetry))
        return attempt(0)
      }
      return null
    }

    const html = await res.text()
    console.log(`${LOG_PREFIX_VK} Got HTML (${html.length} bytes); parsing…`)

    const coverUrl = extractVkCoverFromHtml(html, playlistUrl)
    if (coverUrl) {
      console.log(`${LOG_PREFIX_VK} ✅ Cover found: ${coverUrl}`)
    } else {
      console.warn(`${LOG_PREFIX_VK} Cover NOT found in HTML`)
    }
    return coverUrl
  }

  try {
    await randomDelay(3000, 7000)
    const result = await attempt(8000)
    return result
  } catch (err) {
    console.error(`${LOG_PREFIX_VK} Unexpected error: ${err}`)
    return null
  }
}

function extractVkCoverFromHtml(html: string, sourceUrl: string): string | null {
  const $ = cheerio.load(html)

  // Strategy 1: background-image on .metadata__cover-layout__image
  const bgEl = $('[class*="metadata__cover-layout__image"], [class*="coverImage"]')
  for (const el of bgEl.toArray()) {
    const style = $(el).attr('style') || ''
    const match = style.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/)
    if (match && match[1] && !match[1].startsWith('data:')) {
      console.log(`${LOG_PREFIX_VK} Strategy 1 (bg-image style): ${match[1]}`)
      return ensureAbsoluteUrl(match[1], 'https://vk.com')
    }
  }

  // Strategy 2: og:image (cheerio)
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage && !ogImage.startsWith("data:") && !ogImage.includes("/blank")) {
    console.log(`${LOG_PREFIX_VK} Strategy 2 (og:image): ${ogImage}`)
    return ogImage
  }

  // Strategy 2b: og:image в сыром HTML (порядок content/property у VK часто другой)
  const ogRaw =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogRaw?.[1] && !ogRaw[1].startsWith("data:") && !ogRaw[1].includes("/blank")) {
    console.log(`${LOG_PREFIX_VK} Strategy 2b (og:image raw): ${ogRaw[1]}`)
    return ensureAbsoluteUrl(ogRaw[1], "https://vk.com")
  }

  // Strategy 3: JSON-LD or page script with cover URL containing pp.userapi.com or sun9
  const coverPatterns = [
    /["']?(https?:\/\/(?:pp\.userapi\.com|sun\d+\.userapi\.com|vk\.com\/images)[^"'\s,]+\.(?:jpg|jpeg|png|webp))["']?/gi,
    /["']?(https?:\/\/[^"'\s,]*\/playlist_covers[^"'\s,]+)["']?/gi,
  ]
  const scripts = $('script:not([src])').toArray()
  for (const script of scripts) {
    const text = $(script).html() || ""
    for (const pattern of coverPatterns) {
      pattern.lastIndex = 0
      const match = pattern.exec(text)
      if (match && match[1]) {
        console.log(`${LOG_PREFIX_VK} Strategy 3 (script url): ${match[1]}`)
        return match[1]
      }
    }
  }

  // Strategy 3b: весь HTML (inline JSON в SPA)
  for (const pattern of coverPatterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(html)
    if (match && match[1]) {
      console.log(`${LOG_PREFIX_VK} Strategy 3b (full html url): ${match[1]}`)
      return match[1]
    }
  }

  // Strategy 4: any <img> whose src looks like a playlist/album cover
  const imgs = $('img').toArray()
  for (const img of imgs) {
    const src = $(img).attr('src') || ''
    if (
      src &&
      !src.startsWith('data:') &&
      (src.includes('pp.userapi.com') || src.includes('sun') && src.includes('userapi.com'))
    ) {
      console.log(`${LOG_PREFIX_VK} Strategy 4 (img src): ${src}`)
      return ensureAbsoluteUrl(src, 'https://vk.com')
    }
  }

  console.warn(`${LOG_PREFIX_VK} All strategies failed for ${sourceUrl}`)
  return null
}

function ensureAbsoluteUrl(url: string, base: string): string {
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('/')) return base + url
  return url
}

// ─── Yandex Music ───────────────────────────────────────────────────────────

/** User-Agent close to official Yandex Music Android client (MarshalX-style). */
const YANDEX_MUSIC_MOBILE_UA =
  "YandexMusic/2410 (Android 13; arm64-v8a) com.yandex.music/2410000000 (Pixel 7)"

/**
 * Один запрос к мобильному API для проверки доступности (бэкфилл / диагностика).
 * Не вызывает scrapeYandexPlaylistCover (без задержек скрапера).
 */
export async function preflightYandexMusicApi(): Promise<{
  ok: boolean
  httpStatus?: number
  message: string
}> {
  const owner = "yandexmusic"
  const kind = "1217"
  const pageUrl = `https://music.yandex.ru/users/${owner}/playlists/${kind}`
  const url = `https://api.music.yandex.net/users/${encodeURIComponent(owner)}/playlists/${encodeURIComponent(kind)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: buildYandexMobileApiHeaders(pageUrl),
    })
    clearTimeout(timeout)
    if (res.status === 403 || res.status === 429) {
      return { ok: false, httpStatus: res.status, message: `HTTP ${res.status} (блокировка)` }
    }
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, message: `HTTP ${res.status}` }
    }
    let json: unknown
    try {
      json = await res.json()
    } catch {
      return { ok: false, httpStatus: res.status, message: "Ответ не JSON" }
    }
    const cover = extractYandexCoverUrl(json)
    if (cover) {
      return { ok: true, httpStatus: res.status, message: `OK, обложка: ${cover.slice(0, 72)}…` }
    }
    return { ok: false, httpStatus: res.status, message: "JSON без полей обложки" }
  } catch (e) {
    clearTimeout(timeout)
    const msg = (e as Error).message || String(e)
    return { ok: false, message: msg }
  }
}

function buildYandexMobileApiHeaders(playlistPageUrl: string): Record<string, string> {
  const token = process.env.YANDEX_MUSIC_OAUTH_TOKEN?.trim()
  const h: Record<string, string> = {
    "User-Agent": YANDEX_MUSIC_MOBILE_UA,
    Accept: "application/json",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "X-Yandex-Music-Client": "YandexMusicAndroid/2410",
    Referer: playlistPageUrl,
  }
  if (token) {
    h.Authorization = `OAuth ${token}`
  }
  return h
}

/**
 * Мобильное API (как приложение Яндекс Музыки).
 * Публичные плейлисты часто доступны без токена; при 401 задайте YANDEX_MUSIC_OAUTH_TOKEN.
 */
async function fetchYandexMobileApi(owner: string, kind: string, playlistPageUrl: string): Promise<string | null> {
  const url = `https://api.music.yandex.net/users/${encodeURIComponent(owner)}/playlists/${encodeURIComponent(kind)}`
  console.log(`${LOG_PREFIX_YA} Trying mobile API: ${url}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: buildYandexMobileApiHeaders(playlistPageUrl),
    })
  } catch (err) {
    clearTimeout(timeout)
    console.warn(`${LOG_PREFIX_YA} mobile API fetch error: ${(err as Error).message}`)
    return null
  }
  clearTimeout(timeout)

  console.log(`${LOG_PREFIX_YA} mobile API HTTP ${res.status}`)

  if (res.status === 403 || res.status === 429) {
    console.error(`${LOG_PREFIX_YA} BLOCKED: ${res.status} — mobile API`)
    return null
  }

  if (!res.ok) {
    if (res.status === 401) {
      console.warn(
        `${LOG_PREFIX_YA} mobile API 401 — для приватных плейлистов задайте YANDEX_MUSIC_OAUTH_TOKEN (OAuth из расширения Яндекс Музыки)`
      )
    }
    return null
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }

  const coverUrl = extractYandexCoverUrl(json)
  if (coverUrl) {
    console.log(`${LOG_PREFIX_YA} ✅ Cover from mobile API: ${coverUrl}`)
  } else {
    try {
      console.log(`${LOG_PREFIX_YA} mobile JSON snippet: ${JSON.stringify(json).substring(0, 400)}`)
    } catch {}
  }
  return coverUrl
}

/**
 * Fetches the actual cover image URL from Yandex Music playlist.
 *
 * URL format: https://music.yandex.ru/users/{owner}/playlists/{kind}
 *
 * Порядок: api.music.yandex.net → handlers на music.yandex.ru → HTML.
 *
 * Returns null if the cover cannot be extracted or on hard errors.
 */
export async function scrapeYandexPlaylistCover(playlistUrl: string): Promise<string | null> {
  console.log(`${LOG_PREFIX_YA} Starting scrape for: ${playlistUrl}`)

  const parsed = parseYandexPlaylistUrl(playlistUrl)
  if (!parsed) {
    console.error(`${LOG_PREFIX_YA} ERROR: Cannot parse playlist URL: ${playlistUrl}`)
    return null
  }

  const { owner, kind, tld } = parsed
  console.log(`${LOG_PREFIX_YA} Parsed — owner: ${owner}, kind: ${kind}, tld: ${tld}`)

  await randomDelay(2000, 5000)

  // Strategy 1: official mobile JSON API (stable, no SPA)
  const fromMobile = await fetchYandexMobileApi(owner, kind, playlistUrl)
  if (fromMobile) return fromMobile

  // Strategy 2: web handlers playlist.jsx (как yt-dlp: external-domain, overembed — иначе часто 403)
  const handlersUrl = buildYandexPlaylistHandlersUrl(owner, kind, tld)
  console.log(`${LOG_PREFIX_YA} Trying handlers API: ${handlersUrl}`)
  const fromHandlers = await fetchYandexHandlersApi(handlersUrl, playlistUrl)
  if (fromHandlers) return fromHandlers

  // Strategy 3: HTML (редко даёт og:image на SPA-шелле)
  console.log(`${LOG_PREFIX_YA} Falling back to HTML og:image scrape…`)
  return fetchYandexPageOgImage(playlistUrl, owner, kind)
}

/** URL handlers/playlist.jsx как у официального веб-клиента / yt-dlp. */
function buildYandexPlaylistHandlersUrl(owner: string, kind: string, tld: string): string {
  const host = `music.yandex.${tld}`
  const params = new URLSearchParams({
    owner,
    kinds: kind,
    light: "true",
    lang: tld,
    "external-domain": host,
    overembed: "false",
  })
  return `https://${host}/handlers/playlist.jsx?${params.toString()}`
}

async function fetchYandexHandlersApi(apiUrl: string, playlistPageUrl: string): Promise<string | null> {
  const ua = randomUA()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  let res: Response
  try {
    res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        Referer: playlistPageUrl,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Retpath-Y': playlistPageUrl,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    clearTimeout(timeout)
    console.warn(`${LOG_PREFIX_YA} handlers fetch error: ${(err as Error).message}`)
    return null
  }
  clearTimeout(timeout)
  console.log(`${LOG_PREFIX_YA} handlers HTTP ${res.status}`)

  if (!res.ok) return null

  let json: unknown
  try { json = await res.json() } catch { return null }

  const coverUrl = extractYandexCoverUrl(json)
  if (coverUrl) {
    console.log(`${LOG_PREFIX_YA} ✅ Cover from handlers API: ${coverUrl}`)
  } else {
    try {
      console.log(`${LOG_PREFIX_YA} JSON snippet: ${JSON.stringify(json).substring(0, 500)}`)
    } catch {}
  }
  return coverUrl
}

async function fetchYandexPageOgImage(playlistUrl: string, owner: string, kind: string): Promise<string | null> {
  const ua = randomUA()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  let res: Response
  try {
    res = await fetch(playlistUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Referer': 'https://music.yandex.ru/',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    clearTimeout(timeout)
    console.error(`${LOG_PREFIX_YA} ERROR: HTML fetch failed — ${(err as Error).message}`)
    return null
  }
  clearTimeout(timeout)
  console.log(`${LOG_PREFIX_YA} HTML HTTP ${res.status}`)

  if (!res.ok) {
    console.warn(`${LOG_PREFIX_YA} Non-OK HTML status ${res.status}`)
    return null
  }

  const html = await res.text()
  console.log(`${LOG_PREFIX_YA} Got HTML (${html.length} bytes); parsing og:image…`)

  const $ = cheerio.load(html)

  // og:image (cheerio)
  const ogImg = $('meta[property="og:image"]').attr('content')
  if (ogImg && !ogImg.startsWith('data:')) {
    console.log(`${LOG_PREFIX_YA} ✅ og:image from HTML: ${ogImg}`)
    return normalizeYandexImageUrl(ogImg)
  }

  // og:image raw regex (attr order may differ)
  const ogRaw =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
  if (ogRaw?.[1] && !ogRaw[1].startsWith('data:')) {
    console.log(`${LOG_PREFIX_YA} ✅ og:image raw: ${ogRaw[1]}`)
    return normalizeYandexImageUrl(ogRaw[1])
  }

  // avatars.yandex.net / get-music pattern in script or HTML
  const imgPattern = /https?:\/\/(?:avatars\.yandex\.net|avatars\.mds\.yandex\.net)\/get-music-[^"'\s,]+/g
  const matches = html.match(imgPattern)
  if (matches?.[0]) {
    console.log(`${LOG_PREFIX_YA} ✅ avatars URL from HTML: ${matches[0]}`)
    return normalizeYandexImageUrl(matches[0])
  }

  console.warn(`${LOG_PREFIX_YA} Cover NOT found in HTML for ${playlistUrl}`)
  return null
}

export function parseYandexPlaylistUrl(url: string): { owner: string; kind: string; tld: string } | null {
  const tldMatch = url.match(/music\.yandex\.(ru|com|kz|ua|by)/i)
  const tld = (tldMatch?.[1] || "ru").toLowerCase()

  // https://music.yandex.ru/users/{owner}/playlists/{kind}
  const match = url.match(/music\.yandex\.(?:ru|com|kz|ua|by)\/users\/([^/]+)\/playlists\/(\d+)/i)
  if (match) return { owner: match[1], kind: match[2], tld }

  // Also handle with locale: /ru/users/...
  const match2 = url.match(/music\.yandex\.(?:ru|com|kz|ua|by)\/(?:ru|en)\/users\/([^/]+)\/playlists\/(\d+)/i)
  if (match2) return { owner: match2[1], kind: match2[2], tld }

  return null
}

/** Обложка из одного объекта плейлиста (handlers, mobile `result`, элемент `playlists[]`). */
function extractYandexCoverFromPlaylistObject(playlist: Record<string, unknown>): string | null {
  const ogImage = playlist["ogImage"] as string | undefined
  if (ogImage) return normalizeYandexImageUrl(ogImage)

  const cover = playlist["cover"] as Record<string, unknown> | undefined
  if (cover) {
    const coverType = cover["type"] as string | undefined
    if (coverType === "mosaic") {
      const itemsUri = cover["itemsUri"] as unknown
      if (Array.isArray(itemsUri) && itemsUri.length > 0) {
        const first = itemsUri[0]
        if (typeof first === "string" && first.length > 0) {
          return normalizeYandexImageUrl(first)
        }
      }
      const items = cover["items"] as unknown
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0]
        if (typeof first === "string" && first.length > 0) {
          return normalizeYandexImageUrl(first)
        }
      }
    }
    const uri = cover["uri"] as string | undefined
    if (uri) return normalizeYandexImageUrl(uri)
    const coverUri = cover["coverUri"] as string | undefined
    if (coverUri) return normalizeYandexImageUrl(coverUri)
  }

  const cwt = playlist["coverWithoutText"] as Record<string, unknown> | undefined
  if (cwt) {
    const uri = (cwt["uri"] || cwt["coverUri"]) as string | undefined
    if (uri) return normalizeYandexImageUrl(uri)
  }

  return null
}

export function extractYandexCoverUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>

  // Мобильное API: { result: { ogImage, cover, ... } }
  const mobileResult = d["result"] as Record<string, unknown> | undefined
  if (mobileResult && (mobileResult["cover"] || mobileResult["ogImage"] || mobileResult["coverWithoutText"])) {
    const u = extractYandexCoverFromPlaylistObject(mobileResult)
    if (u) return u
  }

  // { playlist: { ... } }
  const single = d["playlist"] as Record<string, unknown> | undefined
  if (single) {
    const u = extractYandexCoverFromPlaylistObject(single)
    if (u) return u
  }

  // { playlists: [ { ... } ] } — частый ответ при kinds
  const list = d["playlists"]
  if (Array.isArray(list) && list.length > 0 && list[0] && typeof list[0] === "object") {
    const u = extractYandexCoverFromPlaylistObject(list[0] as Record<string, unknown>)
    if (u) return u
  }

  // Корень = сам объект плейлиста
  if (d["cover"] || d["ogImage"] || d["coverWithoutText"]) {
    return extractYandexCoverFromPlaylistObject(d)
  }

  return null
}

/** Converts a Yandex avatars.yandex.net URL to a full 400×400 URL */
export function normalizeYandexImageUrl(uri: string): string {
  if (!uri) return uri

  // Already absolute
  let url = uri
  if (!url.startsWith('http')) {
    url = 'https://' + url
  }

  // Replace %% (size placeholder) with 400x400
  url = url.replace(/%%$/, '400x400')

  // Replace size in avatars.yandex.net URLs: /get-music-.../orig → /get-music-.../400x400
  url = url.replace(/(\/get-music-[^/]+\/[^/]+)\/orig$/, '$1/400x400')

  return url
}
