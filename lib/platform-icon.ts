/**
 * Иконки площадок для форм и шапок секций (F-07).
 *
 * Раньше иконки брались из внешнего CDN (`cdn.simpleicons.org`) и из файла
 * `/spotify-logo.png`, которого в `public/` нет — на экране висели битые
 * картинки. Один источник: `public/images/dsp-icons`; наличие файлов
 * проверяет `lib/platform-icon.test.ts`.
 */
export const PLATFORM_ICONS = {
  vk: '/images/dsp-icons/vk-music.png',
  yandex: '/images/dsp-icons/yandex-music.svg',
  spotify: '/images/dsp-icons/spotify.svg',
  mts: '/images/dsp-icons/mts-music.svg',
  sber: '/images/dsp-icons/sber-music.svg',
} as const

export type PlatformIconKey = keyof typeof PLATFORM_ICONS

/** Иконка по названию площадки в любом написании; null — если площадка чужая. */
export function getPlatformIconSrc(platform: string | null | undefined): string | null {
  const p = (platform ?? '').trim().toLowerCase()
  if (!p) return null
  if (p.includes('яндекс') || p.includes('yandex')) return PLATFORM_ICONS.yandex
  if (p.includes('vk') || p.includes('вк')) return PLATFORM_ICONS.vk
  if (p.includes('spotify') || p.includes('спотифай')) return PLATFORM_ICONS.spotify
  if (p.includes('мтс') || p.includes('mts')) return PLATFORM_ICONS.mts
  if (p.includes('сбер') || p.includes('sber') || p.includes('звук') || p.includes('zvuk')) {
    return PLATFORM_ICONS.sber
  }
  return null
}
