"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { Report } from "@/lib/storage"
import { canAcknowledgeReports } from "@/lib/report-acknowledgment"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReportPreview } from "@/components/report-preview"

interface ArtistReportsProps {
  username: string
  reports: Report[]
  artistName: string
}

export default function ArtistReports({ username, reports: initialReports, artistName }: ArtistReportsProps) {
  const [reports, setReports] = useState(initialReports)
  // По умолчанию — самый свежий год, за который ЕСТЬ отчёты (а не календарный год).
  // Иначе артист с отчётами только за прошлый год видит «Нет отчётов за 2026».
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const ys = [
      ...new Set(
        initialReports
          .map((r) => r.year)
          .filter((y): y is number => typeof y === "number")
      ),
    ].sort((a, b) => b - a)
    return ys[0] ?? new Date().getFullYear()
  })
  const [previewReportId, setPreviewReportId] = useState<string | null>(null)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [ackMessage, setAckMessage] = useState<string | null>(null)

  const acknowledgeGate = useMemo(() => canAcknowledgeReports(reports), [reports])

  const years = [
    ...new Set(
      reports.map((report) => report.year).filter((y): y is number => typeof y === "number")
    ),
  ].sort((a, b) => b - a)

  const reportsByQuarter = reports
    .filter((report) => report.year === currentYear)
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

  const handleDownloadReport = (reportId: string) => {
    window.open(`/api/reports/download/${reportId}`, "_blank")
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
      <div className="p-0 md:p-0 max-w-full pb-24">
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
          <span className="text-white">Отчёты</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">ОТЧЁТЫ</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Квартальные отчёты, предпросмотр и скачивание PDF.
            </p>
          </div>
          {years.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setCurrentYear(year)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    year === currentYear
                      ? "bg-primary/20 border-primary/30 text-primary"
                      : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {years.length > 0 ? (
        <>
          <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-5 mb-8">
            <p className="text-sm text-gray-400 leading-relaxed">
              Пожалуйста, внимательно проверьте отчёт перед получением выплаты. Нажав кнопку «Ознакомился», вы подтверждаете, что все треки учтены, данные верны и вы согласны с итоговой суммой. После этого мы отправим вам ссылку на подписание документа в рабочий чат.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mt-3">
              Если вы обнаружили ошибку, не нашли какой-либо трек или у вас возникли вопросы — не нажимайте кнопку, а напишите в рабочую группу в Telegram, чтобы мы могли оперативно всё исправить.
            </p>
            {ackMessage && (
              <p className="text-sm text-primary mt-3 font-mono">{ackMessage}</p>
            )}
          </div>

          {sortedQuarters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {sortedQuarters.map((quarter) => (
                <div key={quarter} className="space-y-4">
                  <h2 className="text-sm font-mono uppercase tracking-widest text-gray-500 border-b border-white/5 pb-2">
                    {quarter} {currentYear}
                  </h2>
                  <div className="space-y-3">
                    {reportsByQuarter[quarter].map((report) => (
                      <div
                        key={report.id}
                        className="card-glass rounded-2xl border border-white/5 p-4 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden relative">
                          <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-black flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl text-emerald-400">description</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate">
                            Отчёт за {quarter} {report.year}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1 font-mono tabular-nums">
                            {(report as any).generatedDate
                              ? `Сгенерирован: ${new Date((report as any).generatedDate).toLocaleDateString("ru-RU")}`
                              : report.uploadDate
                                ? `Загружен: ${new Date(report.uploadDate).toLocaleDateString("ru-RU")}`
                                : "—"}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono uppercase tracking-wider">
                            <span className={`inline-flex items-center gap-1 ${report.isSigned ? "text-emerald-400" : "text-red-400"}`}>
                              <span className="material-symbols-outlined text-sm">
                                {report.isSigned ? "verified" : "cancel"}
                              </span>
                              {report.isSigned ? "Подписан" : "Не подписан"}
                            </span>
                            {report.isAcknowledged && (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <span className="material-symbols-outlined text-sm">task_alt</span>
                                Ознакомлен
                              </span>
                            )}
                            <span className="text-yellow-400/90 tabular-nums">
                              {Math.round(report.totalAmount || 0).toLocaleString("ru-RU")} ₽
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewReportId(report.id)}
                            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            aria-label="Предпросмотр"
                            title="Предпросмотр"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(report.id)}
                            className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            aria-label="Скачать"
                            title="Скачать"
                          >
                            <span className="material-symbols-outlined text-[20px]">download</span>
                          </button>
                        </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5">
                          {report.isAcknowledged ? (
                            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
                              <span className="material-symbols-outlined text-base">check_circle</span>
                              Вы ознакомились
                            </span>
                          ) : acknowledgeGate.allowed ? (
                            <button
                              type="button"
                              disabled={acknowledgingId === report.id}
                              onClick={() => handleAcknowledge(report.id)}
                              className="bg-[#10b981] hover:bg-emerald-400 disabled:opacity-60 text-black font-bold rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 transition-all"
                            >
                              {acknowledgingId === report.id ? "Сохранение..." : "Ознакомился"}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <button
                                type="button"
                                disabled
                                className="rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-widest border border-white/10 text-gray-500 cursor-not-allowed"
                              >
                                Ознакомился
                              </button>
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
            <div className="text-center py-12 text-gray-500 font-mono text-sm uppercase tracking-wider mb-12">
              Нет отчётов за {currentYear} год
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 card-glass rounded-2xl border border-white/5 mb-12">
          <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 opacity-30">folder_off</span>
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">
            Отчёты для {artistName} пока не сгенерированы
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-between items-center text-sm border-t border-white/5 pt-6">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse" />
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>

      <Dialog open={previewReportId !== null} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent className="max-w-4xl bg-[#0f0f0f] border border-white/10 text-white sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg tracking-wide text-white">Предпросмотр отчёта</DialogTitle>
          </DialogHeader>
          {previewReportId && <ReportPreview reportId={previewReportId} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
