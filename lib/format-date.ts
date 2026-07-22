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
