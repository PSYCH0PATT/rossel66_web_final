"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  FolderMinus,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SortField, SortState } from "@/components/report-sort-controls"
import { downloadFileFromApi, quarterArchiveName } from "@/lib/download-file"
import { EmptyState } from "@/components/ui/empty-state"
import { Pagination } from "@/components/ui/pagination"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { formatMoney } from "@/lib/format-money"
import { reportFolderActions } from "@/lib/report-folder"
import { pluralize } from "@/lib/plural"

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

/** Виды экрана «Отчёты», которые собирает квартальный список (решение 0-а). */
export type ReportsListFilter = "all" | "unpaid"

export const REPORTS_DEFAULT_SORT: SortState = { sort: "uploadedAt", dir: "desc" }

export const REPORTS_SORT_FIELDS: SortField[] = [
  "uploadedAt",
  "artistName",
  "totalAmount",
  "totalPlays",
  "isAcknowledged",
  "isSigned",
  "isPaid",
]

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

type Props = {
  /** Чип экрана: «Все» или «Невыплаченные» (0-а). */
  filter: ReportsListFilter
  /** Сортировка живёт в Toolbar экрана — сюда приходит готовым значением. */
  sort: SortState
  /** Тумблер поменял статус: счётчики в шапке экрана нужно пересчитать. */
  onDataChange?: () => void
}

/**
 * Квартальные папки отчётов — развёрнутый вид стал таблицей выплат.
 *
 * Решение 0-а (docs/ia-decisions.md): у отчёта и выплаты одна сущность и один
 * жизненный цикл, поэтому таблица /payments переехала внутрь квартальной папки
 * /reports: строка на артиста — «отчёт · сумма · подпись · выплачено». Чипы и
 * сортировка поднялись на уровень экрана, здесь остаются только папки.
 */
export default function ReportsList({ filter, sort, onDataChange }: Props) {
  const [pairs, setPairs] = useState<QuarterYear[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [collapsedQuarters, setCollapsedQuarters] = useState<Set<string>>(new Set())
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
          sort: sort.sort,
          dir: sort.dir,
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
    [filter, sort]
  )

  // D3: при смене фильтра перезагружаем уже открытые кварталы с 1-й страницы.
  // Сортировка тоже серверная, поэтому её смена требует такой же перезагрузки.
  useEffect(() => {
    for (const key of Object.keys(cache)) {
      const pair = pairs.find((p) => pairLabel(p) === key)
      if (pair) void loadQuarterPage(pair, 1, cache[key].pageSize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, sort])

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
      onDataChange?.()
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
      onDataChange?.()
    } catch (error) {
      console.error("Ошибка при удалении:", error)
      alert("Ошибка при удалении отчёта")
    }
  }

  /**
   * F-43: деньги и подпись — не переключатель настроек. Оба тумблера
   * спрашивают подтверждение, промах мышью больше не отмечает выплату.
   */
  const confirmStatusChange = (
    report: Report,
    statusType: "signed" | "paid",
    value: boolean
  ): boolean => {
    const who = `${report.artistName} — ${report.quarter} ${report.year}`
    const sum = formatMoney(report.totalAmount)
    if (statusType === "signed") {
      return confirm(
        value
          ? `Отметить отчёт как подписанный?\n${who}`
          : `Снять отметку о подписи?\n${who}`
      )
    }
    return confirm(
      value
        ? `Отметить выплату на ${sum}?\n${who}`
        : `Снять отметку о выплате на ${sum}?\n${who}`
    )
  }

  const handleStatusUpdate = async (
    report: Report,
    statusType: "signed" | "paid",
    value: boolean,
    pair: QuarterYear
  ) => {
    if (!confirmStatusChange(report, statusType, value)) return
    const key = pairLabel(pair)
    try {
      const response = await fetch("/api/reports/update-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, statusType, value }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Ошибка при обновлении статуса")
      }
      setCache((prev) => {
        const c = prev[key]
        if (!c) return prev
        return {
          ...prev,
          [key]: {
            ...c,
            reports: c.reports.map((row) => {
              if (row.id !== report.id) return row
              return {
                ...row,
                [statusType === "signed" ? "isSigned" : "isPaid"]: value,
              }
            }),
          },
        }
      })
      // Под фильтром «Невыплаченные» отмеченная строка список покидает —
      // страницу берём заново, чтобы total и пагинация не разъехались.
      const block = cache[key]
      if (filter !== "all" && block) {
        void loadQuarterPage(pair, block.page, block.pageSize)
      }
      onDataChange?.()
    } catch (error) {
      console.error("Ошибка при обновлении статуса:", error)
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

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

      {pairs.map((pair) => {
        const key = pairLabel(pair)
        const isCollapsed = collapsedQuarters.has(key)
        const block = cache[key]
        const quarterReports = block?.reports ?? []
        const total = block?.total ?? pair.count ?? 0
        const page = block?.page ?? 1
        const pageSize = block?.pageSize ?? 20
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
                      {block?.loading ? "Загрузка…" : pluralize(total, ["отчёт", "отчёта", "отчётов"])}
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
                  {/* C-03/F-13: удаление папки равновесило primary. Теперь оно в
                      overflow строки — редкое и деструктивное, с подтверждением. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Действия над папкой ${key}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-white"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 border border-white/10 bg-black/90 backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        disabled={!folderActions.canDeleteFolder}
                        className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                        onSelect={() => {
                          void handleDeleteQuarter(pair)
                        }}
                      >
                        <FolderMinus className="h-4 w-4" />
                        Удалить папку
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    {filter !== "all" ? "Нет отчётов по выбранному фильтру." : "Нет отчётов."}
                  </p>
                ) : (
                  <>
                    {/* C-10/F-76: без горизонтального скролла колонка «Выплачено»
                        на 390 уходила за край — отметить выплату с телефона было
                        нельзя. */}
                    <div className="rounded-xl border border-white/10 overflow-hidden table-glass">
                      <DataTable tableClassName="min-w-[640px]">
                        <DataTableHeader>
                          <DataTableHeadRow>
                            <DataTableHeadCell>Артист</DataTableHeadCell>
                            <DataTableHeadCell>Отчёт</DataTableHeadCell>
                            <DataTableHeadCell>Сумма</DataTableHeadCell>
                            <DataTableHeadCell>Подпись</DataTableHeadCell>
                            <DataTableHeadCell>Выплачено</DataTableHeadCell>
                            <DataTableHeadCell className="text-right">
                              <span className="sr-only">Действия</span>
                            </DataTableHeadCell>
                          </DataTableHeadRow>
                        </DataTableHeader>
                        <DataTableBody>
                          {quarterReports.map((report) => (
                            <DataTableRow key={report.id} className="table-row-hover">
                              <DataTableCell className="min-w-0 max-w-[220px] font-medium text-white">
                                <span className="truncate block">{report.artistName}</span>
                              </DataTableCell>
                              <DataTableCell>
                                <Button
                                  variant="success-outline"
                                  size="sm"
                                  onClick={() => handleDownloadReport(report.id, report.fileName)}
                                  className="whitespace-nowrap"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Скачать
                                </Button>
                              </DataTableCell>
                              {/* C-16/F-16: одна и та же сумма на всех экранах — formatMoney */}
                              <DataTableCell className="font-display text-white [font-variant-numeric:tabular-nums] whitespace-nowrap">
                                {formatMoney(report.totalAmount)}
                              </DataTableCell>
                              {/* F-42: один паттерн подписи тумблера — значение справа */}
                              <DataTableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`signed-${report.id}`}
                                    aria-label={`Подпись: ${report.artistName}, ${report.quarter} ${report.year}`}
                                    checked={report.isSigned}
                                    onCheckedChange={(checked) =>
                                      void handleStatusUpdate(report, "signed", checked, pair)
                                    }
                                    className="data-[state=checked]:bg-primary"
                                  />
                                  <span className="text-xs font-mono text-gray-400">
                                    {report.isSigned ? "Да" : "Нет"}
                                  </span>
                                </div>
                              </DataTableCell>
                              <DataTableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    id={`paid-${report.id}`}
                                    aria-label={`Выплачено: ${report.artistName}, ${report.quarter} ${report.year}`}
                                    checked={report.isPaid}
                                    onCheckedChange={(checked) =>
                                      void handleStatusUpdate(report, "paid", checked, pair)
                                    }
                                    className="data-[state=checked]:bg-primary"
                                  />
                                  <span className="text-xs font-mono text-gray-400">
                                    {report.isPaid ? "Да" : "Нет"}
                                  </span>
                                </div>
                              </DataTableCell>
                              <DataTableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      aria-label={`Действия над отчётом ${report.artistName}`}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="w-56 border border-white/10 bg-black/90 backdrop-blur-xl"
                                  >
                                    <DropdownMenuItem
                                      className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                                      onSelect={() => {
                                        void handleDeleteReport(report.id, report.artistName, pair)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Удалить отчёт
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </DataTableCell>
                            </DataTableRow>
                          ))}
                        </DataTableBody>
                      </DataTable>
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
