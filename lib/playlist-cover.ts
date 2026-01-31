/**
 * Обложки плейлистов по платформам (плейсхолдеры, пока в таблицах нет ссылок на картинки).
 * Позже можно заменить на парсинг реальных ссылок.
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
};

/**
 * Возвращает URL обложки плейлиста по названию платформы.
 * Если платформа не в списке — возвращает общий плейсхолдер.
 */
export function getPlaylistCoverUrl(platform: string | null | undefined): string {
  if (!platform || !platform.trim()) {
    return '/placeholder.svg';
  }
  const normalized = platform.trim();
  return COVER_BY_PLATFORM[normalized] ?? '/placeholder.svg';
}
