"use client"

import { useState, useEffect } from "react"
import { Banner } from "@/components/ui/banner"
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
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge, type ReleaseStatusVariant } from "@/components/ui/status-badge"

interface ParseStats {
  total: number
  added: number
  updated: number
  skipped: number
  errors: string[]
}

interface ParserStatus {
  lastRun: string
  success: boolean
  stats: ParseStats
  message: string
  pagesProcessed?: number
  totalPages?: number
}

interface ZvonkoRelease {
  id: string
  title: string
  artist: string
  cover: string
  upc: string
  label: string
  date: string
  territories: string
  platforms: string
  genre: string
  page: number
  position_on_page: number
  status: string
  parsed_at: string
}

const inputCls =
  "h-9 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

/**
 * C-15: бейдж из кита вместо CSS-классов .release-status-badge--*.
 * Маппинг местный: у Zvonko «Новый» — это «в доставке», а не модерация,
 * как на карточке релиза. Расхождение данных, а не стиля.
 */
function statusVariant(raw: string): ReleaseStatusVariant {
  const s = raw || ""
  if (["Доставлен", "released", "Одобрен"].includes(s)) return "live"
  if (["Новый"].includes(s)) return "delivered"
  if (["В доставке", "delivery"].includes(s)) return "delivered"
  if (["Модерируется", "На модерации", "moderation", "scheduled"].includes(s)) return "moderation"
  if (["Отклонен", "Отклонён", "Снят"].includes(s)) return "rejected"
  return "draft"
}

export default function ZvonkoParserPage() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  /** F-36: параметры запуска и справка по режимам — по требованию. */
  const [paramsOpen, setParamsOpen] = useState(false)
  const [modesOpen, setModesOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [lastReleases, setLastReleases] = useState<ZvonkoRelease[]>([])
  const [pagesToParse, setPagesToParse] = useState<number>(1)
  const [selectedAction, setSelectedAction] = useState<"parse" | "compare" | "add">("parse")

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/zvonko-parser")
      const data = await response.json()

      if (data.success && data.status) {
        setStatus(data.status)
      }

      if (data.releases) {
        setLastReleases(data.releases)
      }
    } catch (error) {
      console.error("Ошибка загрузки статуса:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const runParser = async () => {
    setIsRunning(true)

    try {
      const response = await fetch("/api/zvonko-parser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: selectedAction,
          pagesToParse: pagesToParse,
        }),
      })
      const data = await response.json()

      if (data.success) {
        setStatus({
          lastRun: new Date().toISOString(),
          success: true,
          stats: data.stats,
          message: data.message,
          pagesProcessed: data.pagesProcessed,
          totalPages: data.totalPages,
        })

        if (data.releases) {
          setLastReleases(data.releases)
        }
      } else {
        setStatus({
          lastRun: new Date().toISOString(),
          success: false,
          stats: data.stats || { total: 0, added: 0, updated: 0, skipped: 0, errors: [data.error || "Неизвестная ошибка"] },
          message: data.error || "Ошибка парсинга",
        })
      }
    } catch (error) {
      console.error("Ошибка запуска парсера:", error)
      setStatus({
        lastRun: new Date().toISOString(),
        success: false,
        stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [String(error)] },
        message: "Ошибка подключения к серверу",
      })
    } finally {
      setIsRunning(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const actionLabel =
    selectedAction === "parse" ? "Запустить парсинг" : selectedAction === "compare" ? "Сравнить с системой" : "Добавить новые"

  const actionRunningLabel =
    selectedAction === "parse" ? "Парсинг…" : selectedAction === "compare" ? "Сравнение…" : "Добавление…"

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
          <Spinner label="Загрузка…" />
        </div>
      )
  }

  return (
    
      <div className="space-y-8">
        {/* F-36: шапка парсера — один шаблон с koala-parser; «Страниц» и
            «Действие» свёрнуты в «Параметры запуска» у самой кнопки — в
            обычный день их не трогают. F-35: CTA того же цвета, что там.
            F-60/0-д п.3: имя парсера одно и то же в навигации, меню и H1. */}
        <PageHeader
          title="Zvonko Parser"
          subtitle="Парсинг, сравнение и добавление релизов из Zvonko Digital."
          meta={
            paramsOpen && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <FormField label="Страниц" htmlFor="pages" className="space-y-1">
                  <Input
                    id="pages"
                    type="number"
                    min={1}
                    max={50}
                    value={pagesToParse}
                    onChange={(e) => setPagesToParse(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
                    className={`${inputCls} w-20 text-center`}
                    disabled={isRunning}
                  />
                </FormField>
                {/* F-12: нативный select с системной стрелкой в тёмной форме */}
                <FormField label="Действие" htmlFor="action" className="space-y-1">
                  <Select
                    value={selectedAction}
                    onValueChange={(v) => setSelectedAction(v as "parse" | "compare" | "add")}
                    disabled={isRunning}
                  >
                    <SelectTrigger id="action" className={`${inputCls} min-w-[180px]`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parse">Парсинг</SelectItem>
                      <SelectItem value="compare">Сравнение</SelectItem>
                      <SelectItem value="add">Добавление</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            )
          }
          actions={
            <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={paramsOpen}
              onClick={() => setParamsOpen((open) => !open)}
              className="rounded-lg font-mono text-xs uppercase tracking-widest text-gray-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>tune</span>
              Параметры запуска
              <span className="material-symbols-outlined text-base" aria-hidden>
                {paramsOpen ? "expand_less" : "expand_more"}
              </span>
            </Button>
            <Button onClick={() => void runParser()} disabled={isRunning} variant="cta" className="rounded-lg">
              {isRunning ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin" aria-hidden>progress_activity</span>
                  {actionRunningLabel}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" aria-hidden>
                    {selectedAction === "parse"
                      ? "download"
                      : selectedAction === "compare"
                        ? "sync"
                        : "play_arrow"}
                  </span>
                  {actionLabel}
                </>
              )}
            </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          <StatCard
            label="Последний запуск"
            tone="azure"
            bgIcon="schedule"
            value={
              // Значение — не число, а строка в дисплейном шрифте: он широкий,
              // и на узкой карточке «не запускался»/дата упирались в край.
              <span className="text-xl [overflow-wrap:anywhere]">
                {status?.lastRun ? formatDate(status.lastRun) : "Никогда"}
              </span>
            }
          />

          <StatCard
            label="Статус"
            tone="primary"
            bgIcon="flag"
            value={
              <span
                className={`text-xl [overflow-wrap:anywhere] ${
                  status?.success ? "text-primary" : status?.lastRun ? "text-destructive" : "text-status-warning"
                }`}
              >
                {status?.success ? "Успешно" : status?.lastRun ? "Ошибка" : "Не запускался"}
              </span>
            }
          />

          <StatCard label="Найдено" tone="azure" bgIcon="travel_explore" value={status?.stats?.total ?? 0} />

          <StatCard label="Добавлено" tone="primary" bgIcon="library_add" value={status?.stats?.added ?? 0} />

          <StatCard
            label="Страниц"
            tone="purple"
            bgIcon="layers"
            value={`${status?.pagesProcessed ?? 0}/${status?.totalPages ?? pagesToParse}`}
          />
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <SectionHeader className="mb-2" title="Расписание автоматического парсинга" />
          <p className="text-sm text-gray-400 mb-4">Парсер может запускаться по расписанию (cron).</p>
          <div className="flex flex-wrap gap-6 text-sm text-gray-300">
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schedule</span>
              12:00 (полдень)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schedule</span>
              20:00 (вечер)
            </span>
          </div>
        </div>

        {status?.message && (
          <Banner
            variant={status.success ? "success" : "danger"}
            icon={status.success ? "check_circle" : "cancel"}
          >
            <p className="font-medium">{status.message}</p>
            {status.stats && (
              <p className="text-sm text-gray-500 font-mono mt-2">
                Всего: {status.stats.total} · Добавлено: {status.stats.added} · Обновлено: {status.stats.updated} ·
                Пропущено: {status.stats.skipped}
              </p>
            )}
            {status.pagesProcessed != null && (
              <p className="text-sm text-gray-500 font-mono mt-1">
                Обработано страниц: {status.pagesProcessed}/{status.totalPages ?? pagesToParse}
              </p>
            )}
            {status.stats?.errors && status.stats.errors.length > 0 && (
              <ul className="mt-2 text-sm space-y-1">
                {status.stats.errors.map((err, index) => (
                  <li key={index}>• {err}</li>
                ))}
              </ul>
            )}
          </Banner>
        )}

        {lastReleases.length > 0 && (
          <div className="card-glass rounded-2xl border border-white/5 p-0 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="p-6 md:p-8 pb-0">
              <SectionHeader className="mb-1" title="Последние обработанные релизы" />
              <p className="text-sm text-gray-400 mb-4">Релизы из последнего запуска парсера</p>
            </div>
            <div className="table-glass">
              <DataTable>
                <DataTableHeader>
                  <DataTableHeadRow>
                    <DataTableHeadCell>Название</DataTableHeadCell>
                    <DataTableHeadCell>Артист</DataTableHeadCell>
                    <DataTableHeadCell>Статус</DataTableHeadCell>
                    <DataTableHeadCell>UPC</DataTableHeadCell>
                    <DataTableHeadCell>Жанр</DataTableHeadCell>
                    <DataTableHeadCell>Площадки</DataTableHeadCell>
                    <DataTableHeadCell>Дата</DataTableHeadCell>
                    <DataTableHeadCell>Стр.</DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHeader>
                <DataTableBody>
                  {lastReleases.map((release) => (
                    <DataTableRow key={release.id} className="table-row-hover">
                      <DataTableCell className="text-white font-medium">
                        <div className="flex items-center gap-2 min-w-[12rem]">
                          {release.cover ? (
                            <img
                              src={release.cover}
                              alt={release.title}
                              className="w-8 h-8 rounded object-cover border border-white/10 shrink-0"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : null}
                          {release.title}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">{release.artist}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge variant={statusVariant(release.status)} withIcon={false}>
                          {release.status}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">
                        {release.upc ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-primary text-base">barcode_scanner</span>
                            {release.upc}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">{release.genre || <span className="text-gray-600">—</span>}</DataTableCell>
                      <DataTableCell className="text-gray-400 max-w-[12rem] truncate" title={release.platforms}>
                        {release.platforms ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-xs font-mono text-gray-400">
                            {release.platforms}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">{release.date || "—"}</DataTableCell>
                      <DataTableCell className="text-gray-400">
                        <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-xs font-mono">
                          {release.page}
                        </span>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </div>
        )}

        {/* 2.4: справка «Режимы работы» — редкая, поэтому свёрнута и внизу. */}
        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={modesOpen}
            onClick={() => setModesOpen((open) => !open)}
            className="rounded-lg px-0 font-mono text-xs uppercase tracking-widest text-gray-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>tune</span>
            Режимы работы
            <span className="material-symbols-outlined text-base" aria-hidden>
              {modesOpen ? "expand_less" : "expand_more"}
            </span>
          </Button>
          {modesOpen && (
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-400">
              <div className="space-y-2">
                <h4 className="text-white font-semibold">Парсинг</h4>
                <p>Извлечение данных о релизах из Zvonko Digital.</p>
                <p className="text-xs font-mono text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-accent-azure">download</span>
                  Название, артист, UPC, обложка, даты
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-white font-semibold">Сравнение</h4>
                <p>Сопоставление с существующими релизами в системе.</p>
                <p className="text-xs font-mono text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-accent-azure">sync</span>
                  Дубликаты по UPC и названиям
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-white font-semibold">Добавление</h4>
                <p>Добавление новых релизов в систему.</p>
                <p className="text-xs font-mono text-gray-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-base text-accent-azure">play_arrow</span>
                  Треки и ISRC
                </p>
              </div>
              </div>
            </div>
          )}
        </div>

      </div>
    )
}
