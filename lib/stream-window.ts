import { mskDateString } from "@/lib/msk-date"

/**
 * Окно графика стримов — одно на дашборд и аналитику (F-18).
 *
 * «ВСЕГО ПРОСЛУШИВАНИЙ 60» на дашборде против «ОБЩЕЕ ЧИСЛО СТРИМОВ 107» в
 * аналитике получалось потому, что окна считались в двух местах и по-разному:
 * страницы дашборда резали границы в UTC (`toISOString()`), а аналитика — в
 * МСК. Через границу московских суток окна расходились на день, а вместе с
 * ними и цифры.
 *
 * Границы календарные и московские: ключи данных аналитики — это московские
 * даты (см. lib/msk-date.ts).
 */

/** Период дашборда по умолчанию — он же пресет «30д» в аналитике. */
export const STREAM_WINDOW_DAYS = 30

export interface StreamWindow {
  startDate: string
  endDate: string
}

/** Последние `days` дней по московскому календарю. */
export function dashboardStreamWindow(
  days: number = STREAM_WINDOW_DAYS,
  now: Date = new Date()
): StreamWindow {
  const span = Number.isFinite(days) && days > 0 ? days : STREAM_WINDOW_DAYS
  const start = new Date(now.getTime() - span * 24 * 60 * 60 * 1000)
  return {
    startDate: mskDateString(start),
    endDate: mskDateString(now),
  }
}

/** Пресет селекта аналитики («7d», «30d», «90d», …) — то же окно. */
export function analyticsStreamWindow(period: string, now: Date = new Date()): StreamWindow {
  const days = Number.parseInt(period, 10)
  return dashboardStreamWindow(days, now)
}
