import { parseReleaseDateToTimestamp } from "@/lib/release-date"

/**
 * Единое форматирование даты в русский вид DD.MM.YYYY.
 * Поддерживает "DD.MM.YYYY", "YYYY-MM-DD", ISO-datetime и Date.
 * Для пустого/невалидного значения возвращает fallback (по умолчанию «—»),
 * а не "Invalid Date" или "01.01.1970".
 *
 * Дата форматируется в UTC (значения хранятся как календарная дата),
 * чтобы не сдвигаться на день у зрителей западнее UTC.
 */
export function formatDateRu(
  input: string | Date | null | undefined,
  fallback = "—"
): string {
  if (input == null || input === "") return fallback
  const ts =
    input instanceof Date ? input.getTime() : parseReleaseDateToTimestamp(input)
  if (!ts || Number.isNaN(ts)) return fallback
  return new Date(ts).toLocaleDateString("ru-RU", { timeZone: "UTC" })
}

/**
 * A8: подпись дня на оси графиков — «DD.MM».
 *
 * Точки графика ключуются календарной датой ("YYYY-MM-DD"), а `new Date(...)`
 * для такой строки даёт UTC-полночь. Прежний `d.getDate()` читал ЛОКАЛЬНУЮ дату,
 * поэтому у зрителя западнее UTC вся ось сдвигалась на день назад.
 */
export function formatDayMonthUtc(input: string | Date | null | undefined): string {
  if (input == null || input === "") return ""
  const ts = input instanceof Date ? input.getTime() : Date.parse(String(input))
  if (Number.isNaN(ts)) return ""
  const d = new Date(ts)
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  return `${day}.${month}`
}
