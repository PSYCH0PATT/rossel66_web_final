/**
 * Обложки плейлистов по платформам (плейсхолдеры — фоллбэк, когда coverUrl не распарсен).
 */
const COVER_BY_PLATFORM: Record<string, string> = {
  'Яндекс Музыка': '/images/playlists/yandex-music.png',
  'VK Музыка': '/images/playlists/vk-music.png',
  'МТС Музыка': '/images/playlists/mts-music.png',
  'MTS Music': '/images/playlists/mts-music.png',
  'Сбер Музыка': '/images/playlists/sber-music.png',
  'Sber Music': '/images/playlists/sber-music.png',
  'Одноклассники': '/placeholder.svg',
  'Spotify': '/placeholder.svg',
  'Apple Music': '/placeholder.svg',
  'YouTube Music': '/placeholder.svg',
}

/**
 * Возвращает URL обложки плейлиста.
 *
 * Порядок приоритетов:
 *   1. coverUrl из БД (реальная обложка, распарсенная скрапером)
 *   2. Статический плейсхолдер по платформе
 *   3. /placeholder.svg
 */
export function getPlaylistCoverUrl(
  platform: string | null | undefined,
  coverUrl?: string | null
): string {
  if (coverUrl && coverUrl.trim()) return coverUrl.trim()
  if (!platform || !platform.trim()) return '/placeholder.svg'
  return COVER_BY_PLATFORM[platform.trim()] ?? '/placeholder.svg'
}
