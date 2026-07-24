/**
 * Календарная дата (YYYY-MM-DD) в часовом поясе Europe/Moscow.
 * Совпадает с ключами данных rossel_flash_YYYY_MM_DD и остальным пайплайном.
 * UTC-вариант (new Date().toISOString()) сдвигал день в 21:00–24:00 МСК.
 */
export function mskDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
