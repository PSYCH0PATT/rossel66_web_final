import { isNextImageRemoteHostAllowed } from '@/lib/next-image-hosts'

/**
 * Плейсхолдер обложки по платформе — фоллбэк, когда coverUrl не распарсен.
 * I4: матчим по ключевым словам без учёта регистра/написания, иначе «VK Music»,
 * «Яндекс.Музыка», «вк музыка» и т.п. падали в серый /placeholder.svg вместо лого.
 */
function placeholderForPlatform(platform: string): string {
  const p = platform.trim().toLowerCase()
  if (p.includes('яндекс') || p.includes('yandex')) return '/images/playlists/yandex-music.png'
  if (p.includes('vk') || p.includes('вк')) return '/images/playlists/vk-music.png'
  if (p.includes('мтс') || p.includes('mts')) return '/images/playlists/mts-music.png'
  if (p.includes('сбер') || p.includes('sber')) return '/images/playlists/sber-music.png'
  return '/placeholder.svg'
}

/** Макс. сторона обложки для UI (карточки ~200–350px; 400 хватает под retina). */
const DISPLAY_COVER_MAX = 400

/**
 * F-06: часть строк в cover_url приехала из API как есть — без схемы
 * («avatars.yandex.net/get-music-content/…»). В src такой адрес уходит
 * относительным путём и даёт битую картинку.
 */
function withScheme(url: string): string {
  if (url.startsWith('/') || url.startsWith('//')) return url
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url
  return `https://${url}`
}

/**
 * F-06: отрисует ли это браузер через next/image. Битая обложка — это всегда
 * одно из трёх: не абсолютный https, хост вне remotePatterns (оптимизатор
 * отвечает 400) или неразрешённый плейсхолдер размера `%%` в пути.
 */
export function isRenderableCoverUrl(url: string): boolean {
  if (!url) return false
  if (url.includes('%%')) return false
  if (url.startsWith('/')) return true

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  return isNextImageRemoteHostAllowed(parsed.hostname)
}

/**
 * Ужимает известные URL обложек Яндекс/CDN для сетки и next/image:
 * в БД часто лежит m1000x1000 — тянуть её для карточки не нужно.
 * Локальные пути и неизвестные URL не трогаем.
 */
export function optimizePlaylistCoverForDisplay(url: string): string {
  const u = withScheme(url.trim())
  if (!u.startsWith("http")) return u

  try {
    const parsed = new URL(u)
    const h = parsed.hostname.toLowerCase()
    const isYandexAvatar =
      h === "avatars.yandex.net" ||
      h === "avatars.mds.yandex.net" ||
      h.endsWith(".akamaized.net")

    if (!isYandexAvatar) return u

    let p = parsed.pathname

    // .../mWxH/ — только если реально больше лимита (не раздуваем m200x200)
    p = p.replace(/\/m(\d+)x(\d+)(?=\/|$|\?)/i, (_m, w, h) => {
      const mw = parseInt(String(w), 10)
      const mh = parseInt(String(h), 10)
      if (!Number.isFinite(mw) || !Number.isFinite(mh)) return _m
      if (Math.max(mw, mh) <= DISPLAY_COVER_MAX) return _m
      return `/m${DISPLAY_COVER_MAX}x${DISPLAY_COVER_MAX}`
    })

    // полноразмер /orig в пути Яндекс-аватаров
    p = p.replace(/\/orig(?=$|\/|\?)/i, `/m${DISPLAY_COVER_MAX}x${DISPLAY_COVER_MAX}`)

    // плейсхолдер размера в API-URI (…/%%)
    p = p.replace(/\/?%%$/i, `/m${DISPLAY_COVER_MAX}x${DISPLAY_COVER_MAX}`)

    parsed.pathname = p
    return parsed.toString()
  } catch {
    return u
  }
}

/**
 * Возвращает URL обложки плейлиста.
 *
 * Порядок приоритетов:
 *   1. coverUrl из БД (реальная обложка, распарсенная скрапером) — для UI ужимается до ~400px, если это Яндекс CDN
 *   2. Статический плейсхолдер по платформе
 *   3. /placeholder.svg
 *
 * F-06: нерисуемый coverUrl (не https, чужой хост, `%%` в пути) — это не «почти
 * обложка», а гарантированно битая картинка на экране. Такой URL не отдаём:
 * лучше честная заглушка платформы.
 */
export function getPlaylistCoverUrl(
  platform: string | null | undefined,
  coverUrl?: string | null
): string {
  if (coverUrl && coverUrl.trim()) {
    const display = optimizePlaylistCoverForDisplay(coverUrl.trim())
    if (isRenderableCoverUrl(display)) return display
  }
  if (!platform || !platform.trim()) return '/placeholder.svg'
  return placeholderForPlatform(platform)
}
