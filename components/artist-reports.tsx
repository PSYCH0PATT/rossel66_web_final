"use client"

import { useMemo, useState, type ReactNode } from "react"
import type { ArtistBalance, Report } from "@/lib/storage"
import { canAcknowledgeReports } from "@/lib/report-acknowledgment"
import { formatDateRu } from "@/lib/format-date"
import { formatMoney } from "@/lib/format-money"
import { isReportYearDerived, reportEffectiveYear } from "@/lib/report-year"
import { downloadFileFromApi } from "@/lib/download-file"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReportPreview } from "@/components/report-preview"
import ArtistBalanceSummary from "@/components/artist-balance-summary"
import { Banner } from "@/components/ui/banner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterChip } from "@/components/ui/filter-chip"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { StatusBadge } from "@/components/ui/status-badge"

interface ArtistReportsProps {
  username: string
  reports: Report[]
  artistName: string
  /**
   * C-01: заголовок шапки. Админский экран отчётов артиста передаёт сюда своё
   * «Отчёты: {имя}» — раньше он рисовал собственный `<h1>` над компонентом и
   * на странице оказывалось два заголовка подряд разного размера.
   */
  title?: string
  /**
   * Баланс артиста. Передан — это объединённый экран «Отчёты и выплаты» в
   * кабинете артиста (решение 0-а, артистская половина): сверху появляется
   * денежный блок с бывшего /payments, а на карточках квартала — статус
   * выплаты, единственное, чего в них не было и что показывал дубль.
   * Не передан — это админская вкладка отчётов артиста, она не меняется.
   */
  balance?: ArtistBalance | null
  /** Подзаголовок шапки; у объединённого экрана он про деньги, а не только про PDF. */
  subtitle?: ReactNode
}

export default function ArtistReports({
  username,
  reports: initialReports,
  artistName,
  title = "ОТЧЁТЫ",
  balance,
  subtitle = "Квартальные отчёты, предпросмотр и скачивание PDF.",
}: ArtistReportsProps) {
  /** Экран денег показывается только там, где есть баланс (кабинет артиста). */
  const showMoney = balance !== undefined
  const [reports, setReports] = useState(initialReports)
  // По умолчанию — самый свежий год, за который ЕСТЬ отчёты (а не календарный год).
  // Иначе артист с отчётами только за прошлый год видит «Нет отчётов за 2026».
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const ys = [
      ...new Set(
        initialReports
          .map((r) => reportEffectiveYear(r))
          .filter((y): y is number => typeof y === "number")
      ),
    ].sort((a, b) => b - a)
    return ys[0] ?? new Date().getFullYear()
  })
  const [previewReportId, setPreviewReportId] = useState<string | null>(null)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [ackMessage, setAckMessage] = useState<string | null>(null)
  /** C-11/F-44: на 390 инструкция занимала весь первый экран. */
  const [instructionOpen, setInstructionOpen] = useState(false)

  const acknowledgeGate = useMemo(() => canAcknowledgeReports(reports), [reports])

  // D2: отчёт без заполненного year не попадал ни в одну вкладку (был невидим),
  // хотя его сумма учитывалась в балансе. Год выводим из даты загрузки.
  const years = [
    ...new Set(
      reports
        .map((report) => reportEffectiveYear(report))
        .filter((y): y is number => typeof y === "number")
    ),
  ].sort((a, b) => b - a)

  const reportsByQuarter = reports
    .filter((report) => reportEffectiveYear(report) === currentYear)
    .reduce<Record<string, Report[]>>((acc, report) => {
      if (!acc[report.quarter]) {
        acc[report.quarter] = []
      }
      acc[report.quarter].push(report)
      return acc
    }, {})

  const sortedQuarters = Object.keys(reportsByQuarter).sort((a, b) => {
    const quarterOrder: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
    return quarterOrder[a] - quarterOrder[b]
  })

  const handleDownloadReport = (reportId: string, fileName: string) => {
    void downloadFileFromApi(`/api/reports/download/${reportId}`, fileName)
  }

  const handleClosePreview = () => {
    setPreviewReportId(null)
  }

  const handleAcknowledge = async (reportId: string) => {
    setAcknowledgingId(reportId)
    setAckMessage(null)
    try {
      const res = await fetch("/api/reports/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAckMessage(data.error ?? "Не удалось сохранить ознакомление")
        return
      }
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                isAcknowledged: true,
                acknowledgedAt: data.acknowledgedAt ?? new Date().toISOString(),
              }
            : r
        )
      )
      setAckMessage(data.message ?? "Спасибо. Ссылка на подписание будет в рабочем Telegram-канале.")
    } catch {
      setAckMessage("Не удалось сохранить ознакомление")
    } finally {
      setAcknowledgingId(null)
    }
  }

  return (
    <>
      <div className="space-y-8">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          years.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <FilterChip
                  key={year}
                  tone="success"
                  active={year === currentYear}
                  onClick={() => setCurrentYear(year)}
                >
                  {year}
                </FilterChip>
              ))}
            </div>
          ) : undefined
        }
      />

      {showMoney && (
        <ArtistBalanceSummary
          balance={balance ?? null}
          paidAmount={reports
            .filter((report) => report.isPaid)
            .reduce((sum, report) => sum + (report.totalAmount ?? 0), 0)}
        />
      )}

      {years.length > 0 ? (
        <>
          {/*
            F-44: два абзаца во всю ширину занимали на 390 весь первый экран, и
            карточка отчёта — то, за чем артист сюда пришёл — уходила под фолд.
            Текст цел, читается один раз и сворачивается.
          */}
          <Banner variant="info" icon={null} className="mb-8 block rounded-2xl p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-sm text-gray-300">
                Проверьте отчёт перед тем, как нажать «Ознакомился».
              </p>
              <Button
                type="button"
                variant="outline"
                aria-expanded={instructionOpen}
                aria-controls="reports-instruction"
                onClick={() => setInstructionOpen((prev) => !prev)}
                className="h-auto rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-widest"
              >
                {instructionOpen ? "Свернуть" : "Подробнее"}
              </Button>
            </div>
            {instructionOpen && (
              <div id="reports-instruction">
                <p className="text-sm text-gray-400 leading-relaxed mt-3">
                  Пожалуйста, внимательно проверьте отчёт перед получением выплаты. Нажав кнопку «Ознакомился», вы подтверждаете, что все треки учтены, данные верны и вы согласны с итоговой суммой. После этого мы отправим вам ссылку на подписание документа в рабочий чат.
                </p>
                <p className="text-sm text-gray-400 leading-relaxed mt-3">
                  Если вы обнаружили ошибку, не нашли какой-либо трек или у вас возникли вопросы — не нажимайте кнопку, а напишите в рабочую группу в Telegram, чтобы мы могли оперативно всё исправить.
                </p>
              </div>
            )}
            {ackMessage && (
              <p className="text-sm text-primary mt-3 font-mono">{ackMessage}</p>
            )}
          </Banner>

          {sortedQuarters.length > 0 ? (
            <div className="space-y-8 mb-12">
              {sortedQuarters.map((quarter) => (
                <div key={quarter} className="space-y-4">
                  <SectionHeader
                    as="h3"
                    size="sm"
                    accent="none"
                    className="mb-0 border-b border-white/5 pb-2"
                    title={
                      <span className="font-mono text-sm uppercase tracking-widest text-gray-500">
                        {quarter} {currentYear}
                      </span>
                    }
                  />
                  <div className="space-y-3">
                    {reportsByQuarter[quarter].map((report) => (
                      <div
                        key={report.id}
                        className="card-glass rounded-2xl border border-white/5 p-4 hover:border-white/10 transition-colors"
                      >
                        {/* На 390 подписанная кнопка скачивания не помещается в
                            один ряд с текстом — там действия уходят под строку. */}
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
                          <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-black flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl text-emerald-400">description</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate">
                            Отчёт за {quarter} {reportEffectiveYear(report) ?? ""}
                            {isReportYearDerived(report) && (
                              <span
                                className="ml-1 text-[10px] font-normal text-amber-400/80"
                                title="Год в отчёте не указан — определён по дате загрузки"
                              >
                                (год по дате загрузки)
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 font-mono tabular-nums">
                            {report.uploadDate ? `Загружен: ${formatDateRu(report.uploadDate)}` : "—"}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono uppercase tracking-wider">
                            {/* F-23: один стиль статуса — тот же StatusBadge, что на /payments. */}
                            <StatusBadge variant={report.isSigned ? "live" : "rejected"} withIcon={false}>
                              {report.isSigned ? "Подписан" : "Не подписан"}
                            </StatusBadge>
                            {report.isAcknowledged && (
                              <StatusBadge variant="live" withIcon={false}>
                                Ознакомлен
                              </StatusBadge>
                            )}
                            {/* Б-16: единственное, чего не было на карточке и что
                                показывал дубль «История отчётов» на /payments. */}
                            {showMoney && (
                              <StatusBadge variant={report.isPaid ? "live" : "warning"} withIcon={false}>
                                {report.isPaid ? "Выплачено" : "Не выплачено"}
                              </StatusBadge>
                            )}
                            <span className="text-yellow-400/90 tabular-nums">
                              {formatMoney(report.totalAmount)}
                            </span>
                          </div>
                        </div>
                        </div>
                        {/* C-13: икон-кнопки — ui/button size=icon, тач 44px из коробки. */}
                        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setPreviewReportId(report.id)}
                            aria-label="Предпросмотр"
                            title="Предпросмотр"
                            className="rounded-lg text-gray-500"
                          >
                            <span className="material-symbols-outlined text-[20px]" aria-hidden>
                              visibility
                            </span>
                          </Button>
                          {/* C-13: у скачивания появилась подпись — до неё
                              главное действие экрана было безымянной иконкой. */}
                          <Button
                            variant="outline"
                            onClick={() => handleDownloadReport(report.id, report.fileName)}
                            className="rounded-lg font-mono text-xs uppercase tracking-widest"
                          >
                            <span className="material-symbols-outlined mr-2 text-[18px]" aria-hidden>
                              download
                            </span>
                            Скачать PDF
                          </Button>
                        </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5">
                          {report.isAcknowledged ? (
                            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
                              <span className="material-symbols-outlined text-base">check_circle</span>
                              Вы ознакомились
                            </span>
                          ) : acknowledgeGate.allowed ? (
                            <Button
                              variant="cta"
                              disabled={acknowledgingId === report.id}
                              onClick={() => handleAcknowledge(report.id)}
                              className="rounded-lg font-mono text-xs uppercase tracking-widest"
                            >
                              {acknowledgingId === report.id ? "Сохранение..." : "Ознакомился"}
                            </Button>
                          ) : (
                            <div className="space-y-2">
                              {/* F-28: недоступная CTA действительно выглядит недоступной. */}
                              <Button
                                variant="outline"
                                disabled
                                className="rounded-lg font-mono text-xs uppercase tracking-widest"
                              >
                                Ознакомился
                              </Button>
                              <p className="text-xs text-gray-500 leading-relaxed">{acknowledgeGate.reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mb-12"
              icon="folder_off"
              title={`Нет отчётов за ${currentYear} год`}
            />
          )}
        </>
      ) : (
        <div className="card-glass rounded-2xl border border-white/5 mb-12">
          <EmptyState
            className="py-16"
            icon="folder_off"
            title={`Отчёты для ${artistName} пока не сгенерированы`}
          />
        </div>
      )}

      </div>

      <Dialog open={previewReportId !== null} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent className="max-w-4xl bg-surface-dialog border border-white/10 text-white sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg tracking-wide text-white">Предпросмотр отчёта</DialogTitle>
          </DialogHeader>
          {previewReportId && <ReportPreview reportId={previewReportId} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
