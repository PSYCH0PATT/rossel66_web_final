"use client"

import { DashboardFooter } from "@/components/dashboard-footer"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { reportUploadedLabel } from "@/lib/report-period"

interface Report {
  id: string
  artistId: string | null
  artistName: string
  quarter: string
  year: number | null
  totalAmount: number | null
  isPaid: boolean | null
  isSigned: boolean | null
  uploadDate: string | null
}

interface Balance {
  artistId: string
  totalBalance: number
  availableForPayout: number
  advanceTotal: number
  advanceRecouped: number
  advanceRemaining: number
  lastUpdated: string
}

interface Props {
  username: string
  reports: Report[]
  balance: Balance | null
}

export default function PaymentsClient({ username, reports, balance }: Props) {
  const reportsByYear = reports.reduce((acc, report) => {
    const year = report.year ?? 0
    if (!acc[year]) acc[year] = []
    acc[year].push(report)
    return acc
  }, {} as Record<number, Report[]>)

  const years = Object.keys(reportsByYear).map(Number).sort((a, b) => b - a)

  const paidAmount = reports.filter((r) => r.isPaid).reduce((sum, r) => sum + (r.totalAmount ?? 0), 0)
  const totalBal = balance?.totalBalance ?? 0
  const avail = balance?.availableForPayout ?? 0

  const advanceTotal = balance?.advanceTotal ?? 0
  const advanceRecouped = balance?.advanceRecouped ?? 0
  const advanceRemaining = balance?.advanceRemaining ?? 0
  const advanceProgress =
    advanceTotal > 0 ? Math.min(100, Math.round((advanceRecouped / advanceTotal) * 100)) : 0

  const fmt = (n: number) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <div className="max-w-full p-0 pb-6 md:pb-0">
      <PageHeader
        className="mb-8"
        title="ВЫПЛАТЫ"
        subtitle="Баланс, доступная сумма к выплате и история отчётов по кварталам."
      />

      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 mb-8">
        <StatCard
          className="border border-white/5"
          label="Общий баланс"
          icon="currency_ruble"
          tone="primary"
          bgIcon="account_balance_wallet"
          value={
            <span data-testid="total-balance">
              {fmt(totalBal)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
            </span>
          }
          footer="Накопленные средства"
        />

        <StatCard
          className="border border-white/5"
          label="Доступно к выплате"
          icon="account_balance"
          tone="warning"
          bgIcon="savings"
          bgIconClassName="text-status-moderation"
          value={
            <span data-testid="available-for-payout">
              {fmt(avail)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
            </span>
          }
          footer={<>Минимум: 3&nbsp;000 ₽</>}
        />

        <StatCard
          className="col-span-2 border border-white/5 md:col-span-2 xl:col-span-1"
          label="Выплачено"
          icon="done_all"
          tone="purple"
          bgIcon="check_circle"
          value={
            <>
              {fmt(paidAmount)} <span className="text-sm text-gray-500 font-sans">₽</span>
            </>
          }
          footer="За всё время"
        />
      </div>

      {advanceTotal > 0 && (
        <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6 mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex-shrink-0">
                <span className="material-symbols-outlined text-xl">payments</span>
              </span>
              <div>
                <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-1">Аванс</h3>
                <p className="text-sm text-gray-400 font-light max-w-md">
                  {advanceRemaining > 0
                    ? "Роялти идут в погашение аванса. Как только он будет закрыт, начисления снова станут доступны к выплате."
                    : "Аванс полностью погашен — начисления снова доступны к выплате."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Выдано</p>
                <p data-testid="advance-total" className="text-xl font-bold text-white font-display tabular-nums">
                  {fmt(advanceTotal)} ₽
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Погашено</p>
                <p
                  data-testid="advance-recouped"
                  className="text-xl font-bold text-emerald-400 font-display tabular-nums"
                >
                  {fmt(advanceRecouped)} ₽
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-1">Осталось</p>
                <p
                  data-testid="advance-remaining"
                  className="text-xl font-bold text-orange-400 font-display tabular-nums"
                >
                  {fmt(advanceRemaining)} ₽
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all"
              style={{ width: `${advanceProgress}%` }}
            />
          </div>
          <p data-testid="advance-progress" className="mt-2 text-xs text-gray-500 tabular-nums">
            Погашено {advanceProgress}% аванса
          </p>
        </div>
      )}

      {/* Про минимальную сумму говорим только когда дело действительно в ней:
          при непогашенном авансе к выплате ноль по другой причине, её объясняет
          карточка выше. */}
      {balance && balance.totalBalance > 0 && balance.availableForPayout === 0 && advanceRemaining === 0 && (
        <Banner variant="warning" icon="info" className="mb-10 p-4 md:p-5">
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Недостаточно средств для выплаты</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Минимальная сумма для выплаты составляет 3&nbsp;000 ₽. У вас накоплено {fmt(balance.totalBalance)} ₽.
              Осталось накопить {fmt(Math.max(0, 3000 - balance.totalBalance))} ₽.
            </p>
          </div>
        </Banner>
      )}

      {reports.length > 0 ? (
        <div className="mb-12">
          <SectionHeader className="mb-6" title="История отчётов" />

          <div className="space-y-10">
            {years.map((year) => (
              <div key={year}>
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4 border-b border-white/5 pb-2">
                  {year}
                </p>
                <div className="divide-y divide-white/5 rounded-2xl border border-white/5 overflow-hidden card-glass">
                  {reportsByYear[year]
                    .sort((a, b) => {
                      const qa = parseInt((a.quarter ?? "Q0").substring(1), 10)
                      const qb = parseInt((b.quarter ?? "Q0").substring(1), 10)
                      return qb - qa
                    })
                    .map((report) => (
                      <div
                        key={report.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
                          <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-black flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl text-emerald-400">description</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate">
                            Отчёт за {report.quarter} {report.year}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <span className="material-symbols-outlined text-sm text-gray-500">calendar_today</span>
                              {/* F-15: дата загрузки файла подписана — без подписи
                                  она читалась как дата периода отчёта. */}
                              {reportUploadedLabel(report.uploadDate)}
                            </span>
                            {/* F-23: тот же StatusBadge, что на /reports — один стиль статуса. */}
                            <StatusBadge variant={report.isSigned ? "live" : "rejected"} withIcon={false}>
                              {report.isSigned ? "Подписан" : "Не подписан"}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="text-xl font-bold text-white font-display tabular-nums">
                            {fmt(report.totalAmount ?? 0)} <span className="text-sm text-gray-500 font-sans">₽</span>
                          </div>
                          <div className="mt-1">
                            <StatusBadge variant={report.isPaid ? "live" : "warning"} withIcon={false}>
                              {report.isPaid ? "Выплачено" : "Не выплачено"}
                            </StatusBadge>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card-glass rounded-2xl border border-white/5 mb-12">
          <EmptyState
            className="py-16"
            icon="receipt_long"
            title="У вас пока нет отчётов"
            description="Здесь будут отображаться ваши отчёты и связанные с ними выплаты."
          />
        </div>
      )}

      <DashboardFooter role="artist" />
      </div>
    </>
  )
}
