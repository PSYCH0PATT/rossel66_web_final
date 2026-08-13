"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDateRu } from "@/lib/format-date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Loader2,
  PenLine,
  Play,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ReportSortControls, type SortState } from "@/components/report-sort-controls"

interface PendingReport {
  id: string
  artistId?: string
  artistName: string
  quarter: string
  year: number
  totalPlays: number
  totalAmount: number
  acknowledgedAt?: string | null
  uploadDate: string
}

const DEFAULT_SORT: SortState = { sort: "acknowledgedAt", dir: "asc" }

/**
 * Отчёты, с которыми артист ознакомился, но подписи ещё нет. Плоский список по
 * всем кварталам: раньше такие строки приходилось выискивать по квартальным
 * карточкам вручную.
 */
export default function PendingSignatureList() {
  const [reports, setReports] = useState<PendingReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (nextPage: number, nextSize: number, sort: SortState) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(nextSize),
        sort: sort.sort,
        dir: sort.dir,
      })
      const res = await fetch(`/api/reports/attention?${params}`)
      if (!res.ok) throw new Error("Не удалось загрузить очередь")
      const data = await res.json()
      setReports(Array.isArray(data.reports) ? data.reports : [])
      setTotal(typeof data.total === "number" ? data.total : 0)
      setPage(nextPage)
      setPageSize(nextSize)
    } catch (error) {
      console.error("Ошибка при загрузке очереди на подпись:", error)
      setReports([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1, 20, DEFAULT_SORT)
  }, [load])

  const changeSort = (next: SortState) => {
    setSortState(next)
    void load(1, pageSize, next)
  }

  const handleSign = async (reportId: string) => {
    try {
      const response = await fetch("/api/reports/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, statusType: "signed", value: true }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Ошибка при обновлении статуса")
      }
      // Подписанный отчёт очередь покидает — убираем строку, не перезагружая страницу.
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error("Ошибка при подписании отчёта:", error)
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <Card className="bg-transparent border-slate-600/30">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 shrink-0">
              <PenLine className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white">Ждут подписи</h3>
              <p className="text-sm text-slate-400">
                {isLoading ? "Загрузка…" : `${total} отчётов ознакомлены, но не подписаны`}
              </p>
            </div>
          </div>
          <ReportSortControls
            value={sortState}
            onChange={changeSort}
            disabled={isLoading}
            fields={["acknowledgedAt", "artistName", "totalAmount", "totalPlays", "year", "uploadedAt"]}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && reports.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-green-400/70" />
            <p className="text-slate-300">Очередь пуста — все ознакомленные отчёты подписаны.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-600/30 bg-transparent p-3 transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-700/20 sm:flex-row sm:items-center sm:p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-base font-semibold text-white sm:h-12 sm:w-12 sm:text-lg">
                      {report.artistName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h4 className="truncate text-base font-semibold text-white sm:text-lg">
                          {report.artistName}
                        </h4>
                        <span className="rounded bg-slate-700/60 px-2 py-0.5 font-mono text-xs text-slate-300">
                          {report.quarter} {report.year}
                        </span>
                      </div>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:gap-4 sm:text-sm">
                        <div className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
                          <Play className="h-3 w-3 flex-shrink-0 text-green-400 sm:h-4 sm:w-4" />
                          <span className="font-medium text-white">
                            {report.totalPlays.toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
                          <DollarSign className="h-3 w-3 flex-shrink-0 text-yellow-400 sm:h-4 sm:w-4" />
                          <span className="font-medium text-white">{report.totalAmount.toFixed(2)} ₽</span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap sm:gap-2">
                          <Calendar className="h-3 w-3 flex-shrink-0 text-slate-400 sm:h-4 sm:w-4" />
                          <span className="text-slate-400">
                            {report.acknowledgedAt
                              ? `ознакомлен ${formatDateRu(report.acknowledgedAt)}`
                              : "дата ознакомления неизвестна"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Label
                          htmlFor={`pending-signed-${report.id}`}
                          className="whitespace-nowrap text-xs text-slate-300 sm:text-sm"
                        >
                          Подписан
                        </Label>
                        <Switch
                          id={`pending-signed-${report.id}`}
                          checked={false}
                          onCheckedChange={(checked) => {
                            if (checked) void handleSign(report.id)
                          }}
                          style={{ backgroundColor: "#475569", border: "1px solid #64748b" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 self-end sm:ml-4 sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/reports/download/${report.id}`, "_blank")}
                      className="whitespace-nowrap border-green-500/50 text-xs text-green-400 hover:bg-green-500/20 hover:text-green-300 sm:text-sm"
                    >
                      <Download className="h-3 w-3 sm:mr-1 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Скачать</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {total > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-600/30 pt-4">
                <span className="text-sm text-slate-400">
                  {from}–{to} из {total}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">На странице:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => void load(1, Number(v), sortState)}>
                    <SelectTrigger className="w-[90px] border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading || page <= 1}
                    onClick={() => void load(page - 1, pageSize, sortState)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-300">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoading || page >= totalPages}
                    onClick={() => void load(page + 1, pageSize, sortState)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
