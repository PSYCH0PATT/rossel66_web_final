"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, CheckCircle, XCircle, DollarSign } from "lucide-react"
import type { Report } from "@/lib/data"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ReportPreview } from "@/components/report-preview"

interface ArtistReportsProps {
  reports: Report[]
  artistName: string
}

export default function ArtistReports({ reports, artistName }: ArtistReportsProps) {
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [previewReportId, setPreviewReportId] = useState<string | null>(null)

  // Получаем только уникальные годы из реальных отчетов
  const years = [...new Set(reports.map((report) => report.year))].sort((a, b) => b - a)

  // Группируем отчеты по кварталам для текущего года
  const reportsByQuarter = reports
    .filter((report) => report.year === currentYear)
    .reduce<Record<string, Report[]>>((acc, report) => {
      if (!acc[report.quarter]) {
        acc[report.quarter] = []
      }
      acc[report.quarter].push(report)
      return acc
    }, {})

  // Сортируем кварталы
  const sortedQuarters = Object.keys(reportsByQuarter).sort((a, b) => {
    const quarterOrder: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
    return quarterOrder[a] - quarterOrder[b]
  })

  // Обработчик скачивания отчета
  const handleDownloadReport = (reportId: string) => {
    window.open(`/api/reports/download/${reportId}`, "_blank")
  }

  // Обработчик предпросмотра отчета
  const handlePreviewReport = (reportId: string) => {
    setPreviewReportId(reportId)
  }

  // Закрытие диалога предпросмотра
  const handleClosePreview = () => {
    setPreviewReportId(null)
  }

  return (
    <div className="space-y-6">
      {years.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Отчеты</h2>
            {years.length > 1 && (
              <div className="flex space-x-2">
                {years.map((year) => (
                  <Button
                    key={year}
                    variant={year === currentYear ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {sortedQuarters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedQuarters.map((quarter) => (
                <div key={quarter} className="space-y-3">
                  <h3 className="text-lg font-medium">
                    {quarter} {currentYear}
                  </h3>
                  {reportsByQuarter[quarter].map((report) => (
                    <Card key={report.id} className="p-4 bg-transparent border-slate-600/30 hover:border-slate-500/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-slate-700/30">
                          <FileText className="h-5 w-5 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">
                            Отчет за {quarter} {report.year}
                          </h4>
                          <p className="text-sm text-gray-400">
                            {report.generatedDate
                              ? `Сгенерирован: ${new Date(report.generatedDate).toLocaleDateString()}`
                              : `Загружен: ${new Date(report.uploadDate).toLocaleDateString()}`}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              {(report as any).isSigned ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="text-xs text-slate-400">
                                {(report as any).isSigned ? "Подписан" : "Не подписан"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-yellow-400" />
                              <span className="text-xs text-slate-400">
                                {Math.round((report as any).totalAmount || 0).toLocaleString()} ₽
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white"
                            onClick={() => handlePreviewReport(report.id)}
                            title="Предпросмотр"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white"
                            onClick={() => handleDownloadReport(report.id)}
                            title="Скачать"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">Нет отчетов за {currentYear} год</div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-400">Отчеты для {artistName} пока не сгенерированы</div>
      )}

      {/* Диалог предпросмотра отчета */}
      <Dialog open={previewReportId !== null} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Предпросмотр отчета</DialogTitle>
          </DialogHeader>
          {previewReportId && <ReportPreview reportId={previewReportId} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
