"use client"

import Link from "next/link"

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

  const fmt = (n: number) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      <div className="max-w-full p-0 pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Выплаты</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">ВЫПЛАТЫ</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Баланс, доступная сумма к выплате и история отчётов по кварталам.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6 mb-8">
        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group border border-white/5">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#10b981]">account_balance_wallet</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary mb-3 border border-primary/20">
                <span className="material-symbols-outlined text-xl">currency_ruble</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Общий баланс</h3>
            </div>
            <div>
              <p className="text-xl font-bold text-white font-display tabular-nums md:text-3xl xl:text-4xl">
                {fmt(totalBal)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">Накопленные средства</p>
            </div>
          </div>
        </div>

        <div className="stat-card-glass p-4 md:p-6 rounded-2xl relative overflow-hidden group border border-white/5">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#eab308]">savings</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-yellow-500/10 text-yellow-400 mb-3 border border-yellow-500/20">
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Доступно к выплате</h3>
            </div>
            <div>
              <p className="text-xl font-bold text-white font-display tabular-nums md:text-3xl xl:text-4xl">
                {fmt(avail)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">Минимум: 3&nbsp;000 ₽</p>
            </div>
          </div>
        </div>

        <div className="stat-card-glass col-span-2 p-4 md:col-span-2 md:p-6 xl:col-span-1 rounded-2xl relative overflow-hidden group border border-white/5">
          <div className="stat-dash-bg-wrap">
            <span className="material-symbols-outlined stat-dash-bg-icon text-[#c084fc]">check_circle</span>
          </div>
          <div className="flex flex-col h-full justify-between relative z-10">
            <div className="mb-4">
              <span className="inline-flex items-center justify-center p-2 rounded-lg bg-purple-500/10 text-purple-400 mb-3 border border-purple-500/20">
                <span className="material-symbols-outlined text-xl">done_all</span>
              </span>
              <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest">Выплачено</h3>
            </div>
            <div>
              <p className="text-xl font-bold text-white font-display tabular-nums md:text-3xl xl:text-4xl">
                {fmt(paidAmount)} <span className="text-sm text-gray-400 font-sans font-normal md:text-lg">₽</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">За всё время</p>
            </div>
          </div>
        </div>
      </div>

      {balance && balance.totalBalance > 0 && balance.availableForPayout === 0 && (
        <div className="card-glass rounded-2xl border border-yellow-500/20 p-4 md:p-5 mb-10 flex gap-3 items-start">
          <span className="material-symbols-outlined text-yellow-400 text-2xl flex-shrink-0" aria-hidden>
            info
          </span>
          <div>
            <h4 className="font-bold text-white text-sm mb-1">Недостаточно средств для выплаты</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Минимальная сумма для выплаты составляет 3&nbsp;000 ₽. У вас накоплено {fmt(balance.totalBalance)} ₽.
              Осталось накопить {fmt(Math.max(0, 3000 - balance.totalBalance))} ₽.
            </p>
          </div>
        </div>
      )}

      {reports.length > 0 ? (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full" />
              История отчётов
            </h2>
          </div>

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
                              {report.uploadDate
                                ? new Date(report.uploadDate).toLocaleDateString("ru-RU")
                                : "—"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span
                                className={`material-symbols-outlined text-sm ${report.isSigned ? "text-emerald-400" : "text-red-400"}`}
                              >
                                {report.isSigned ? "verified" : "schedule"}
                              </span>
                              {report.isSigned ? "Подписан" : "Не подписан"}
                            </span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <div className="text-xl font-bold text-white font-display tabular-nums">
                            {fmt(report.totalAmount ?? 0)} <span className="text-sm text-gray-500 font-sans">₽</span>
                          </div>
                          <div
                            className={`text-[10px] font-mono uppercase tracking-wider mt-1 ${
                              report.isPaid ? "text-emerald-400" : "text-yellow-400"
                            }`}
                          >
                            {report.isPaid ? "Выплачено" : "Не выплачено"}
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
        <div className="flex flex-col items-center justify-center py-16 card-glass rounded-2xl border border-white/5 mb-12">
          <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 opacity-30">receipt_long</span>
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">У вас пока нет отчётов</p>
          <p className="text-[10px] text-gray-600 mt-2 text-center max-w-md px-4">
            Здесь будут отображаться ваши отчёты и связанные с ними выплаты.
          </p>
        </div>
      )}

      <div className="mt-8 mb-6 flex justify-between items-center border-t border-white/5 pt-6 text-sm md:mb-0">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse" />
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>
    </>
  )
}
