export const ACKNOWLEDGE_MIN_UNPAID_RUB = 500

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
  if (unpaidTotal > ACKNOWLEDGE_MIN_UNPAID_RUB - 1) {
    return { allowed: true, unpaidTotal }
  }

  const formatted = Math.round(unpaidTotal).toLocaleString("ru-RU")
  return {
    allowed: false,
    unpaidTotal,
    reason: `Кнопка недоступна: сумма невыплаченных отчётов — ${formatted} ₽. Ознакомление и подписание доступны от ${ACKNOWLEDGE_MIN_UNPAID_RUB} ₽.`,
  }
}
