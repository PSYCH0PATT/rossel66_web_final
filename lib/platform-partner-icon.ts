/**
 * Логотипы площадок для бейджа на карточке плейлиста (не обложки из playlist-cover).
 *
 * VK — PNG как в админке (иконка из data-uri).
 * Яндекс / МТС — SVG с Bandlink (как в admin/playlists), сохранены локально в public/images/dsp-icons/.
 * Сбер — компактный SVG в фирменном зелёном (обложка 512×512 из playlists не подходит).
 * Остальные — public/images/partners/.
 */
export function getPlatformPartnerIconSrc(platform: string): string {
  const p = platform.trim().toLowerCase()

  if (p.includes("vk") || p.includes("вк")) return "/images/dsp-icons/vk-music.png"
  if (p.includes("яндекс") || p.includes("yandex")) return "/images/dsp-icons/yandex-music.svg"
  if (p.includes("мтс") || p.includes("mts")) return "/images/dsp-icons/mts-music.svg"
  if (p.includes("сбер") || p.includes("sber")) return "/images/dsp-icons/sber-music.svg"

  if (p.includes("spotify")) return "/images/partners/spotify.svg"
  if (p.includes("apple")) return "/images/partners/apple_music_dark.svg"
  if (p.includes("youtube")) return "/images/partners/youtube_music_dark.svg"
  if (p.includes("zvuk") || p.includes("звук")) return "/images/partners/zvuk_dark.svg"
  if (p.includes("deezer")) return "/images/partners/deezer.svg"
  if (p.includes("tiktok")) return "/images/partners/tiktok.svg"
  if (p.includes("instagram")) return "/images/partners/instagram_dark.svg"

  return "/images/partners/music_fallback.svg"
}
