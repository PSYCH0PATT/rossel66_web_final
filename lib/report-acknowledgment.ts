/**
 * Два денежных порога отчётного цикла — и фраза, которая их связывает.
 *
 * F-17: артист видел 500 ₽ в хелпере кнопки «Ознакомился» и 3 000 ₽ на карточке
 * выплаты, на разных экранах и без единого слова о том, что это разные вещи.
 * После слияния «Отчёты и выплаты» (решение 0-а, артистская половина) оба порога
 * живут на одном экране, поэтому и объяснены одной строкой — отсюда общий модуль.
 *
 * MIN_PAYOUT_AMOUNT переехал сюда из lib/storage.ts: этот модуль чистый, его
 * можно импортировать в клиентские компоненты, а storage тянет за собой prisma.
 * Прежний экспорт из storage сохранён — поверхность модуля не сужаем.
 */

export const ACKNOWLEDGE_MIN_UNPAID_RUB = 500

/** Минимальная сумма выплаты, ₽. */
export const MIN_PAYOUT_AMOUNT = 3000

/**
 * Связывающая фраза про оба порога. Числа берутся из констант, а не из текста:
 * пороги уже разъезжались по экранам один раз.
 */
export function moneyThresholdsHint(): string {
  const ack = ACKNOWLEDGE_MIN_UNPAID_RUB.toLocaleString("ru-RU")
  const payout = MIN_PAYOUT_AMOUNT.toLocaleString("ru-RU")
  return (
    `Два порога: ознакомление и подписание доступны от ${ack}\u00A0₽ ` +
    `невыплаченных отчётов, выплата — от ${payout}\u00A0₽ на балансе.`
  )
}

export type ReportAmountRow = {
  totalAmount?: number | null
  isPaid?: boolean | null
}

export function isReportUnpaid(report: ReportAmountRow): boolean {
  return report.isPaid !== true
}

export function sumUnpaidReports(reports: ReportAmountRow[]): number {
  return reports
    .filter(isReportUnpaid)
    .reduce((sum, report) => sum + (report.totalAmount ?? 0), 0)
}

export function canAcknowledgeReports(reports: ReportAmountRow[]): {
  allowed: boolean
  unpaidTotal: number
  reason?: string
} {
  const unpaidTotal = sumUnpaidReports(reports)
  if (unpaidTotal >= ACKNOWLEDGE_MIN_UNPAID_RUB) {
    return { allowed: true, unpaidTotal }
  }

  const formatted = Math.round(unpaidTotal).toLocaleString("ru-RU")
  return {
    allowed: false,
    unpaidTotal,
    reason: `Кнопка недоступна: сумма невыплаченных отчётов — ${formatted} ₽. Ознакомление и подписание доступны от ${ACKNOWLEDGE_MIN_UNPAID_RUB} ₽.`,
  }
}
