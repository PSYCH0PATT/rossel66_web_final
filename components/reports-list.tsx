"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDateRu } from "@/lib/format-date"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Download,
  FileText,
  Play,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronRight,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  FolderMinus,
  PenLine,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ReportSortControls, type SortState } from "@/components/report-sort-controls"
import { downloadFileFromApi, quarterArchiveName } from "@/lib/download-file"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterChip } from "@/components/ui/filter-chip"
import { Pagination } from "@/components/ui/pagination"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { reportFolderActions } from "@/lib/report-folder"

interface Report {
  id: string
  artistId?: string
  artistName: string
  quarter: string
  year: number
  fileName: string
  uploadDate: string
  status: "processed" | "pending"
  isRegistered: boolean
  totalPlays: number
  totalAmount: number
  isSigned: boolean
  isPaid: boolean
  isAcknowledged?: boolean
}

type QuarterYear = { quarter: string; year: number; count?: number }

type StatusFilter = "all" | "unsigned" | "unpaid" | "acknowledged_unsigned"

const DEFAULT_SORT: SortState = { sort: "uploadedAt", dir: "desc" }

const SORT_FIELDS = [
  "uploadedAt",
  "artistName",
  "totalAmount",
  "totalPlays",
  "isAcknowledged",
  "isSigned",
  "isPaid",
] as const

type QuarterCache = {
  reports: Report[]
  total: number
  page: number
  pageSize: number
  loading: boolean
}

function pairLabel(pair: QuarterYear) {
  return `${pair.quarter} ${pair.year}`
}

export default function ReportsList() {
  const [pairs, setPairs] = useState<QuarterYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT)
  const [cache, setCache] = useState<Record<string, QuarterCache>>({})

  const fetchPairs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/reports/quarters")
      const data = await response.json()
      const list: QuarterYear[] = Array.isArray(data.quarterYearPairs) ? data.quarterYearPairs : []
      setPairs(list)
      if (list.length > 0) {
        setCollapsedQuarters(new Set(list.map((p) => pairLabel(p))))
      }
    } catch (error) {
      console.error("Ошибка при загрузке отчётов:", error)
      setPairs([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPairs()
  }, [])

  const loadQuarterPage = useCallback(
    async (pair: QuarterYear, page: number, pageSize: number) => {
      const key = pairLabel(pair)
      setCache((prev) => ({
        ...prev,
        [key]: {
          reports: prev[key]?.reports ?? [],
          total: prev[key]?.total ?? 0,
          page,
          pageSize,
          loading: true,
        },
      }))
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          year: String(pair.year),
          sort: sortState.sort,
          dir: sortState.dir,
        })
        // D3: фильтр применяется на сервере, чтобы total/пагинация совпадали с видимыми строками
        if (filter !== "all") params.set("filter", filter)
        const res = await fetch(`/api/reports/list/${encodeURIComponent(pair.quarter)}?${params}`)
        const data = await res.json()
        const reports: Report[] = Array.isArray(data.reports) ? data.reports : []
        const total = typeof data.total === "number" ? data.total : reports.length
        setCache((prev) => ({
          ...prev,
          [key]: { reports, total, page, pageSize, loading: false },
        }))
      } catch {
        setCache((prev) => ({
          ...prev,
          [key]: {
            reports: [],
            total: 0,
            page: 1,
            pageSize,
            loading: false,
          },
        }))
      }
    },
    [filter, sortState]
  )

  // D3: при смене фильтра перезагружаем уже открытые кварталы с 1-й страницы.
  // Сортировка тоже серверная, поэтому её смена требует такой же перезагрузки.
  useEffect(() => {
    for (const key of Object.keys(cache)) {
      const pair = pairs.find((p) => pairLabel(p) === key)
      if (pair) void loadQuarterPage(pair, 1, cache[key].pageSize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sortState])

  const toggleQuarter = (pair: QuarterYear) => {
    const key = pairLabel(pair)
    setCollapsedQuarters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        const cur = cache[key]
        if (!cur || cur.reports.length === 0) {
          void loadQuarterPage(pair, 1, cur?.pageSize ?? 20)
        }
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleDownloadReport = (reportId: string, fileName: string) => {
    void downloadFileFromApi(`/api/reports/download/${reportId}`, fileName)
  }

  /**
   * Год обязателен: без него роут отбирал отчёты по одному лишь кварталу, и в
   * архив за «Q1 2026» попал бы ещё и Q1 других лет.
   */
  const handleDownloadAllReports = (pair: QuarterYear) => {
    const params = new URLSearchParams({ year: String(pair.year) })
    void downloadFileFromApi(
      `/api/reports/download-all/${encodeURIComponent(pair.quarter)}?${params}`,
      quarterArchiveName(pair.quarter, pair.year)
    )
  }

  const handleDeleteQuarter = async (pair: QuarterYear) => {
    const quarterKey = pairLabel(pair)
    const label = `квартал ${pair.quarter} ${pair.year} г.`
    if (!confirm(`Удалить все отчёты за ${label}? Это действие нельзя отменить.`)) {
      return
    }
    try {
      const params = new URLSearchParams({ quarter: pair.quarter, year: String(pair.year) })
      const response = await fetch(`/api/reports/delete-quarter?${params}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Ошибка при удалении")
      }
      setPairs((prev) => prev.filter((p) => !(p.quarter === pair.quarter && p.year === pair.year)))
      setCache((prev) => {
        const next = { ...prev }
        delete next[quarterKey]
        return next
      })
    } catch (error) {
      console.error("Ошибка при удалении квартала:", error)
      alert(error instanceof Error ? error.message : "Ошибка при удалении отчётов квартала")
    }
  }

  const handleDeleteReport = async (reportId: string, artistName: string, pair: QuarterYear) => {
    if (!confirm(`Вы уверены, что хотите удалить отчёт для ${artistName}?`)) {
      return
    }
    try {
      const response = await fetch(`/api/reports/delete/${reportId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Ошибка при удалении отчёта")
      const key = pairLabel(pair)
      setCache((prev) => {
        const c = prev[key]
        if (!c) return prev
        return {
          ...prev,
          [key]: {
            ...c,
            reports: c.reports.filter((r) => r.id !== reportId),
            total: Math.max(0, c.total - 1),
          },
        }
      })
    } catch (error) {
      console.error("Ошибка при удалении:", error)
      alert("Ошибка при удалении отчёта")
    }
  }

  const handleStatusUpdate = async (
    reportId: string,
    statusType: "signed" | "paid",
    value: boolean,
    pair: QuarterYear
  ) => {
    try {
      const response = await fetch("/api/reports/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, statusType, value }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка при обновлении статуса")
      }
      const key = pairLabel(pair)
      setCache((prev) => {
        const c = prev[key]
        if (!c) return prev
        return {
          ...prev,
          [key]: {
            ...c,
            reports: c.reports.map((report) => {
              if (report.id !== reportId) return report
              return {
                ...report,
                [statusType === "signed" ? "isSigned" : "isPaid"]: value,
              }
            }),
          },
        }
      })
    } catch (error) {
      console.error("Ошибка при обновлении статуса:", error)
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const applyFilter = (list: Report[]) =>
    list.filter((report) => {
      switch (filter) {
        case "unsigned":
          return !report.isSigned
        case "unpaid":
          return !report.isPaid
        case "acknowledged_unsigned":
          return Boolean(report.isAcknowledged) && !report.isSigned
        default:
          return true
      }
    })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner label="Загрузка отчётов…" />
      </div>
    )
  }

  if (pairs.length === 0) {
    return (
      <EmptyState
        icon="description"
        title="Нет готовых отчётов"
        description="Готовые отчёты будут появляться здесь после обработки данных"
      />
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        className="mb-4"
        as="h3"
        size="sm"
        accent="none"
        title={
          <span className="flex flex-col">
            <span className="text-lg font-semibold text-white">Готовые отчёты</span>
            <span className="text-sm font-normal text-slate-400">
              Отчёты зарегистрированных артистов (по кварталам и годам)
            </span>
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
        <FilterChip tone="info" active={filter === "all"} onClick={() => setFilter("all")}>
          Все отчёты
        </FilterChip>
        <FilterChip
          tone="danger"
          active={filter === "unsigned"}
          onClick={() => setFilter("unsigned")}
        >
          <XCircle className="mr-1" />
          <span>Неподписанные</span>
        </FilterChip>
        <FilterChip
          tone="orange"
          active={filter === "unpaid"}
          onClick={() => setFilter("unpaid")}
        >
          <DollarSign className="mr-1" />
          <span>Невыплаченные</span>
        </FilterChip>
        <FilterChip
          tone="warning"
          active={filter === "acknowledged_unsigned"}
          onClick={() => setFilter("acknowledged_unsigned")}
        >
          <PenLine className="mr-1" />
          <span>Ознакомлен, не подписан</span>
        </FilterChip>
        <div className="ml-auto">
          <ReportSortControls
            value={sortState}
            onChange={setSortState}
            fields={[...SORT_FIELDS]}
          />
        </div>
      </div>

      {pairs.map((pair) => {
        const key = pairLabel(pair)
        const isCollapsed = collapsedQuarters.has(key)
        const block = cache[key]
        const quarterReports = block ? applyFilter(block.reports) : []
        const total = block?.total ?? pair.count ?? 0
        const page = block?.page ?? 1
        const pageSize = block?.pageSize ?? 20
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const from = total === 0 ? 0 : (page - 1) * pageSize + 1
        const to = Math.min(page * pageSize, total)
        // F-46: над пустой папкой действовать нечем — «Скачать все» отдавало
        // пустой архив, «Удалить папку» предлагало удалить ничего.
        const folderActions = reportFolderActions({ total, loading: block?.loading })

        return (
          <Card key={key} className="bg-transparent border-slate-600/30">
            <CardHeader
              className="pb-3 cursor-pointer hover:bg-slate-700/20 transition-colors"
              onClick={() => toggleQuarter(pair)}
            >
              {/* DS11: на мобильном кнопки не влезали в строку и «Удалить» обрезалась справа */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 shrink-0">
                    <FileText className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-lg font-semibold text-white">{key}</h4>
                    <p className="text-sm text-slate-400">
                      {block?.loading ? "Загрузка…" : `${total} отчётов`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="success-outline"
                    size="sm"
                    disabled={!folderActions.canDownloadAll}
                    title={folderActions.disabledReason ?? undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadAllReports(pair)
                    }}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Скачать все
                  </Button>
                  <Button
                    variant="destructive-outline"
                    size="sm"
                    disabled={!folderActions.canDeleteFolder}
                    title={folderActions.disabledReason ?? "Удалить все отчёты этого квартала и года"}
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDeleteQuarter(pair)
                    }}
                  >
                    <FolderMinus className="h-4 w-4 mr-1" />
                    Удалить папку
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="pt-0">
                {block?.loading && quarterReports.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : quarterReports.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4">
                    {filter !== "all" ? "Нет отчётов по выбранному фильтру на этой странице." : "Нет отчётов."}
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {quarterReports.map((report) => (
                        <div
                          key={report.id}
                          className="flex flex-col sm:flex-row sm:items-center p-3 sm:p-4 rounded-lg bg-transparent border border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700/20 transition-all duration-200 gap-3"
                        >
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-base sm:text-lg flex-shrink-0">
                              {report.artistName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-white text-base sm:text-lg mb-1 sm:mb-2 truncate">
                                {report.artistName}
                              </h4>
                              <div className="flex items-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm mb-2 sm:mb-3">
                                <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                  <Play className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                                  <span className="text-white font-medium">{report.totalPlays.toLocaleString("ru-RU")}</span>
                                  <span className="text-slate-400 hidden sm:inline">прослушиваний</span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-400 flex-shrink-0" />
                                  <span className="text-white font-medium">{report.totalAmount.toFixed(2)} ₽</span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
                                  <span className="text-slate-400">
                                    {formatDateRu(report.uploadDate)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    {report.isAcknowledged ? (
                                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />
                                    )}
                                    <span className="text-slate-300 whitespace-nowrap text-xs sm:text-sm">
                                      Ознакомлен
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    {report.isSigned ? (
                                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-400 flex-shrink-0" />
                                    )}
                                    <Label htmlFor={`signed-${report.id}`} className="text-slate-300 whitespace-nowrap text-xs sm:text-sm">
                                      Подписан
                                    </Label>
                                  </div>
                                  <Switch
                                    id={`signed-${report.id}`}
                                    checked={report.isSigned}
                                    onCheckedChange={(checked) =>
                                      void handleStatusUpdate(report.id, "signed", checked, pair)
                                    }
                                    className="border border-slate-500 data-[state=checked]:bg-brand data-[state=unchecked]:bg-slate-600"
                                  />
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    {report.isPaid ? (
                                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-400 flex-shrink-0" />
                                    )}
                                    <Label htmlFor={`paid-${report.id}`} className="text-slate-300 whitespace-nowrap text-xs sm:text-sm">
                                      Выплачено
                                    </Label>
                                  </div>
                                  <Switch
                                    id={`paid-${report.id}`}
                                    checked={report.isPaid}
                                    onCheckedChange={(checked) =>
                                      void handleStatusUpdate(report.id, "paid", checked, pair)
                                    }
                                    className="border border-slate-500 data-[state=checked]:bg-brand data-[state=unchecked]:bg-slate-600"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0 self-end sm:self-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadReport(report.id, report.fileName)}
                              className="border-green-500/50 text-green-400 hover:bg-green-500/20 hover:text-green-300 whitespace-nowrap text-xs sm:text-sm"
                            >
                              <Download className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Скачать</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDeleteReport(report.id, report.artistName, pair)}
                              className="border-red-500/50 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {total > 0 && (
                      <Pagination
                        className="mt-4 border-t border-slate-600/30 pt-4"
                        page={page}
                        total={total}
                        pageSize={pageSize}
                        loading={block?.loading}
                        itemForms={["отчёт", "отчёта", "отчётов"]}
                        onPageChange={(next) => void loadQuarterPage(pair, next, pageSize)}
                        onPageSizeChange={(size) => void loadQuarterPage(pair, 1, size)}
                      />
                    )}
                  </>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
