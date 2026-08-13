/**
 * Сортировка списков отчётов в админке.
 *
 * Имя поля приходит из query-строки, поэтому в SQL уходит НЕ оно, а выражение из
 * белого списка ниже. Ничего пользовательского в запрос не интерполируется —
 * незнакомое имя молча откатывается на сортировку по умолчанию.
 */

/** Ключ — значение параметра `?sort=`, значение — SQL-выражение. */
const SORTABLE_COLUMNS = {
  artistName: `lower(trim(COALESCE("artistName", '')))`,
  year: `year`,
  quarter: `quarter`,
  uploadedAt: `"uploadedAt"`,
  acknowledgedAt: `"acknowledgedAt"`,
  totalPlays: `COALESCE("totalPlays", 0)`,
  totalAmount: `COALESCE("totalAmount", 0)`,
  isAcknowledged: `COALESCE("isAcknowledged", false)`,
  isSigned: `COALESCE("isSigned", false)`,
  isPaid: `COALESCE("isPaid", false)`,
} as const

export type ReportSortField = keyof typeof SORTABLE_COLUMNS

export const REPORT_SORT_FIELDS = Object.keys(SORTABLE_COLUMNS) as ReportSortField[]

export function isReportSortField(value: unknown): value is ReportSortField {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SORTABLE_COLUMNS, value)
}

/**
 * Собирает тело ORDER BY для внешнего запроса.
 *
 * `fallback` — порядок, если параметр не передан или не входит в белый список.
 * NULLS LAST в обоих направлениях: пустые значения (например `acknowledgedAt` у
 * старых строк) не должны занимать первую страницу.
 *
 * В хвост всегда добавляется `id` — без уникального ключа LIMIT/OFFSET в Postgres
 * не даёт стабильного порядка и строки могут дублироваться между страницами.
 */
export function buildReportOrderBySql(
  sort: string | null,
  dir: string | null,
  fallback: string
): string {
  if (!isReportSortField(sort)) return `${fallback}, id ASC`
  const direction = dir === "asc" ? "ASC" : "DESC"
  return `${SORTABLE_COLUMNS[sort]} ${direction} NULLS LAST, id ASC`
}
