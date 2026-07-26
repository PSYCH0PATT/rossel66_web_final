/**
 * D2: год отчёта, когда поле `year` не заполнено.
 *
 * Отчёт с `year == null` не попадал ни в одну вкладку года в кабинете артиста
 * (вкладки строятся из `report.year`), то есть был невидим — но его
 * `totalAmount` всё равно учитывался в балансе. Артист видел деньги, которых
 * не мог найти в списке.
 *
 * Год выводим из даты загрузки. Это не выдумка: отчёты грузят в том же году
 * (или в начале следующего) — а видимая строка лучше невидимых денег.
 * Дедуп-ключ отчётов тоже должен использовать это значение, иначе несколько
 * отчётов с `year == null` не схлопнутся между собой.
 */

export type ReportYearRow = {
  year?: number | null
  uploadedAt?: string | Date | null
  uploadDate?: string | null
}

export function reportEffectiveYear(report: ReportYearRow): number | null {
  if (typeof report.year === "number" && Number.isFinite(report.year)) {
    return report.year
  }

  for (const candidate of [report.uploadedAt, report.uploadDate]) {
    if (candidate == null || candidate === "") continue
    const ts = candidate instanceof Date ? candidate.getTime() : Date.parse(candidate)
    if (!Number.isNaN(ts)) {
      return new Date(ts).getUTCFullYear()
    }
  }

  return null
}

/** Год выведен из даты загрузки, а не задан в отчёте — UI помечает это. */
export function isReportYearDerived(report: ReportYearRow): boolean {
  return (
    !(typeof report.year === "number" && Number.isFinite(report.year)) &&
    reportEffectiveYear(report) !== null
  )
}
