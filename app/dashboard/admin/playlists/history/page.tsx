"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { DatePicker } from "@/components/ui/date-picker"
import { EmptyState } from "@/components/ui/empty-state"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/status-badge"
import { formatDateRu } from "@/lib/format-date"

interface HistoryRecord {
  id: string
  playlist_url: string
  playlist_name: string
  platform: string
  change_type: "added" | "updated" | "removed" | "position_changed"
  change_date: string
  artist_name: string | null
  artist_id: string | null
  track_title: string | null
  old_position: number | null
  new_position: number | null
  metadata: unknown
  created_at: string
}

/** F-PARS-13: пауза перед запросом, чтобы не стрелять на каждый символ */
const FILTER_DEBOUNCE_MS = 350

const filterInput =
  "h-10 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

/** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

/** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт /api/playlists/history. */
function toIsoDate(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function PlaylistHistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    changeType: "all",
    artistName: "",
    playlistUrl: "",
  })

  /**
   * F-PARS-13: раньше каждый символ в текстовых фильтрах («Артист», «URL»)
   * отправлял запрос — без debounce и без отмены, поэтому ответы гонялись
   * и в таблицу мог попасть результат уже неактуального фильтра.
   */
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadHistory(controller.signal)
    }, FILTER_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [filters])

  const loadHistory = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      if (filters.changeType !== "all") params.append("changeType", filters.changeType)
      if (filters.artistName) params.append("artistName", filters.artistName)
      if (filters.playlistUrl) params.append("playlistUrl", filters.playlistUrl)
      params.append("limit", "100")

      const response = await fetch(`/api/playlists/history?${params.toString()}`, { signal })
      const data = await response.json()

      if (data.success) {
        setHistory(data.results || [])
      }
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return
      console.error("Ошибка загрузки истории:", error)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      added: "Добавлен",
      updated: "Обновлён",
      removed: "Удалён",
      position_changed: "Позиция",
    }
    return labels[type] || type
  }

  /**
   * C-15: бейдж из кита вместо CSS-класса .release-status-badge с цветами
   * по месту. Тон на тип изменения сохранён прежний.
   */
  const getChangeTypeVariant = (type: string): StatusBadgeProps["variant"] => {
    const map: Record<string, StatusBadgeProps["variant"]> = {
      added: "live",
      updated: "delivered",
      removed: "rejected",
      position_changed: "warning",
    }
    return map[type] || "draft"
  }

  /**
   * A10: change_date — это календарная дата ("YYYY-MM-DD") без времени.
   * `new Date(...)` давал UTC-полночь → в МСК рисовалось фиктивное «03:00».
   * Показываем дату изменения, а точное время — из created_at.
   */
  const formatChangeDate = (dateString: string) => formatDateRu(dateString)

  const formatChangeTime = (createdAt: string | null | undefined) => {
    if (!createdAt) return null
    const ts = new Date(createdAt).getTime()
    if (Number.isNaN(ts)) return null
    return new Date(ts).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    })
  }

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      changeType: "all",
      artistName: "",
      playlistUrl: "",
    })
  }

  /** Фильтры «тронуты» — значит пустой список это результат поиска, а не пустой экран. */
  const hasActiveFilters =
    filters.startDate !== "" ||
    filters.endDate !== "" ||
    filters.changeType !== "all" ||
    filters.artistName !== "" ||
    filters.playlistUrl !== ""

  return (
    <div className="space-y-8">
        <PageHeader title="История плейлистов" subtitle="Изменения из SFTP и синхронизаций" />

        {/* C-14/F-41: пока записей нет и фильтры не тронуты, показывать блок из
            пяти полей незачем — экран открывается пустым состоянием. */}
        {(history.length > 0 || hasActiveFilters || loading) && (
        <div className="card-glass rounded-2xl border border-white/5 p-6">
          <SectionHeader
            className="mb-6"
            size="sm"
            title={
              <>
                <span className="material-symbols-outlined text-primary" aria-hidden>filter_alt</span>
                Фильтры
              </>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* F-12: нативные date-инпуты выпадали из тёмной темы */}
            <FormField label="Дата от" htmlFor="filter-start-date" className="space-y-1.5">
              <DatePicker
                id="filter-start-date"
                value={parseIsoDate(filters.startDate)}
                onChange={(date) => setFilters({ ...filters, startDate: toIsoDate(date) })}
                placeholder="дд.мм.гггг"
                className={`${filterInput} w-full justify-start normal-case`}
              />
            </FormField>
            <FormField label="Дата до" htmlFor="filter-end-date" className="space-y-1.5">
              <DatePicker
                id="filter-end-date"
                value={parseIsoDate(filters.endDate)}
                onChange={(date) => setFilters({ ...filters, endDate: toIsoDate(date) })}
                placeholder="дд.мм.гггг"
                className={`${filterInput} w-full justify-start normal-case`}
              />
            </FormField>
            <FormField label="Тип" htmlFor="filter-change-type" className="space-y-1.5">
              <Select value={filters.changeType} onValueChange={(value) => setFilters({ ...filters, changeType: value })}>
                <SelectTrigger id="filter-change-type" className={filterInput}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="added">Добавлен</SelectItem>
                  <SelectItem value="updated">Обновлён</SelectItem>
                  <SelectItem value="removed">Удалён</SelectItem>
                  <SelectItem value="position_changed">Позиция</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Артист" htmlFor="filter-artist" className="space-y-1.5">
              <Input
                id="filter-artist"
                placeholder="Имя..."
                value={filters.artistName}
                onChange={(e) => setFilters({ ...filters, artistName: e.target.value })}
                className={filterInput}
                spellCheck={false}
              />
            </FormField>
            <FormField label="URL" htmlFor="filter-url" className="space-y-1.5">
              <Input
                id="filter-url"
                placeholder="URL плейлиста..."
                value={filters.playlistUrl}
                onChange={(e) => setFilters({ ...filters, playlistUrl: e.target.value })}
                className={filterInput}
                spellCheck={false}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {/* F-20: «Обновить» одного вида на всех экранах админки — ghost. */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="rounded-lg text-gray-400 hover:text-white"
            >
              <span className={`material-symbols-outlined text-lg mr-1 ${loading ? "motion-safe:animate-spin" : ""}`}>
                refresh
              </span>
              Обновить
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters} className="rounded-lg border-white/15 text-gray-300 hover:bg-white/5">
              Сбросить
            </Button>
          </div>
        </div>
        )}

        <div className="card-glass rounded-2xl border border-white/5 p-6">
          {/* F-59: полосы секций экрана одного цвета */}
          <SectionHeader
            className="mb-6"
            size="sm"
            title={
              <>
                <span className="material-symbols-outlined text-primary" aria-hidden>history</span>
                Записи ({history.length})
              </>
            }
          />
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner label="Загрузка…" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState className="py-12 border border-dashed border-white/10 rounded-xl" title="Нет записей" />
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden table-glass">
              <DataTable tableClassName="min-w-[700px]">
                <DataTableHeader>
                  <DataTableHeadRow>
                    <DataTableHeadCell>Дата</DataTableHeadCell>
                    <DataTableHeadCell>Тип</DataTableHeadCell>
                    <DataTableHeadCell>Плейлист</DataTableHeadCell>
                    <DataTableHeadCell>Платформа</DataTableHeadCell>
                    <DataTableHeadCell>Артист</DataTableHeadCell>
                    <DataTableHeadCell>Трек</DataTableHeadCell>
                    <DataTableHeadCell>Позиция</DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHeader>
                <DataTableBody>
                  {history.map((record) => (
                    <DataTableRow key={record.id} className="table-row-hover">
                      <DataTableCell className="text-gray-300 whitespace-nowrap [font-variant-numeric:tabular-nums] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-500">schedule</span>
                          <span>{formatChangeDate(record.change_date)}</span>
                          {formatChangeTime(record.created_at) && (
                            <span className="text-gray-500">{formatChangeTime(record.created_at)}</span>
                          )}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge variant={getChangeTypeVariant(record.change_type)} withIcon={false}>
                          {getChangeTypeLabel(record.change_type)}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell className="min-w-0 max-w-xs">
                        <div className="truncate text-white" title={record.playlist_name}>
                          {record.playlist_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={record.playlist_url}>
                          {record.playlist_url}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">{record.platform}</DataTableCell>
                      <DataTableCell className="text-gray-300">{record.artist_name || "—"}</DataTableCell>
                      <DataTableCell className="min-w-0 max-w-[140px]">
                        {record.track_title ? (
                          <div className="truncate text-gray-400" title={record.track_title}>
                            {record.track_title}
                          </div>
                        ) : (
                          "—"
                        )}
                      </DataTableCell>
                      <DataTableCell className="text-gray-300 [font-variant-numeric:tabular-nums]">
                        {record.change_type === "position_changed" &&
                        record.old_position !== null &&
                        record.new_position !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{record.old_position}</span>
                            <span>→</span>
                            <span className="font-medium text-white">{record.new_position}</span>
                          </div>
                        ) : record.new_position !== null ? (
                          record.new_position
                        ) : (
                          "—"
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </div>

      </div>
    )
}
