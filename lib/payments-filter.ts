/**
 * Условие «невыплачено» для отчётов (F-69).
 *
 * Строка с нулевой (или отсутствующей) суммой — не долг: платить по ней нечего.
 * Раньше такие отчёты («0 ₽» у NENEVESTA и BORDUN) попадали и в список
 * «Невыплаченные», и в жёлтый счётчик «Невыплаченных 53» на /payments, из-за
 * чего ключевая метрика экрана завышалась шумом.
 *
 * Счётчик и список считаются в базе, поэтому канон здесь — `unpaidReportWhere()`;
 * `isUnpaidPayment` повторяет то же правило в памяти.
 */

export type PaymentRow = {
  totalAmount?: number | null
  isPaid?: boolean | null
}

export type UnpaidReportWhere = {
  OR: Array<{ isPaid: false } | { isPaid: null }>
  totalAmount: { gt: number }
}

/** Prisma-фрагмент where для списка и счётчика невыплаченных. */
export function unpaidReportWhere(): UnpaidReportWhere {
  return {
    OR: [{ isPaid: false }, { isPaid: null }],
    totalAmount: { gt: 0 },
  }
}

/** Тот же предикат в памяти — для проверок и клиентских счётчиков. */
export function isUnpaidPayment(row: PaymentRow): boolean {
  if (row.isPaid === true) return false
  return typeof row.totalAmount === "number" && row.totalAmount > 0
}
