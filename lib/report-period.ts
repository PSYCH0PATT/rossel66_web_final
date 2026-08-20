import { formatDateRu } from "@/lib/format-date"

/**
 * Период отчёта и дата его загрузки — разные величины (F-15).
 *
 * На карточках выплат рядом с «Отчёт за Q4 2025» стояла голая дата 17.08.2026
 * с иконкой календаря: без подписи она читается как дата периода или
 * подписания, и отчёт выглядит датированным на восемь месяцев позже своего
 * квартала. Противоречия в данных нет — это дата загрузки файла, и называть
 * её надо своим именем. Сам период выводится из квартала, а не из файла.
 */

const QUARTER_MONTHS: Record<string, { from: number; to: number }> = {
  Q1: { from: 1, to: 3 },
  Q2: { from: 4, to: 6 },
  Q3: { from: 7, to: 9 },
  Q4: { from: 10, to: 12 },
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Календарные границы квартала: Q4 2025 → 2025-10-01 … 2025-12-31. */
export function quarterPeriodRange(
  quarter: string | null | undefined,
  year: number | null | undefined
): { start: string; end: string } | null {
  const months = quarter ? QUARTER_MONTHS[quarter.trim().toUpperCase()] : undefined
  if (!months || !year || !Number.isFinite(year)) return null
  const lastDay = new Date(Date.UTC(year, months.to, 0)).getUTCDate()
  return {
    start: `${year}-${pad(months.from)}-01`,
    end: `${year}-${pad(months.to)}-${pad(lastDay)}`,
  }
}

/** Человеческая подпись периода отчёта: «01.10.2025 — 31.12.2025». */
export function reportPeriodLabel(
  quarter: string | null | undefined,
  year: number | null | undefined
): string {
  const range = quarterPeriodRange(quarter, year)
  if (!range) return "—"
  return `${formatDateRu(range.start)} — ${formatDateRu(range.end)}`
}

/**
 * Подписанная дата загрузки файла отчёта: «Загружен: 17.08.2026».
 * Форматирование — через formatDateRu (UTC), иначе дата съезжает на день
 * у зрителя западнее UTC.
 */
export function reportUploadedLabel(
  uploadDate: string | Date | null | undefined
): string {
  return `Загружен: ${formatDateRu(uploadDate)}`
}
