/**
 * Год отчёта, когда поле `year` не заполнено — выводим его из даты загрузки.
 *
 * Нужен в двух местах, и оба про склейку, а не про показ:
 *  - дедуп-ключ отчётов `(artistId, quarter, year)` в балансе и на дашбордах —
 *    без общего значения года несколько отчётов с `year == null` за один
 *    квартал не схлопнулись бы и задвоили сумму;
 *  - подпись периода в списке отчётов, чтобы Q1 разных лет не выглядели
 *    одинаково.
 *
 * Догадка честная: отчёты грузят в том же году или в начале следующего.
 * Раньше здесь же жил `isReportYearDerived` — пометка «(год по дате загрузки)»
 * на карточке. Она имела смысл, пока список фильтровался по году и отчёт без
 * года мог стать невидимым. Фильтра по году больше нет, отчёты показываются все
 * сразу, поэтому пометка ушла вместе с ним.
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
