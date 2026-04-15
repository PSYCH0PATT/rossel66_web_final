"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

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

function statusBadgeClass(raw: string): string {
  const s = raw || ""
  if (["Доставлен", "released", "Одобрен"].includes(s)) return "release-status-badge release-status-badge--live"
  if (["Новый"].includes(s)) return "release-status-badge release-status-badge--delivered"
  if (["В доставке", "delivery"].includes(s)) return "release-status-badge release-status-badge--delivered"
  if (["Модерируется", "На модерации", "moderation", "scheduled"].includes(s))
    return "release-status-badge release-status-badge--moderation"
  if (["Отклонен", "Отклонён", "Снят"].includes(s)) return "release-status-badge release-status-badge--rejected"
  return "release-status-badge release-status-badge--draft"
}

export default function ZvonkoParserPage() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
      <Layout role="admin" requiredRole="admin">
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-mono uppercase tracking-widest">Загрузка…</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-8 max-w-7xl mx-auto pb-8">
        <div className="space-y-4">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest flex-wrap gap-x-2 gap-y-1">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/releases" className="hover:text-primary">
              Релизы
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Zvonko Parser</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white uppercase tracking-tight">
              Zvonko Digital Parser
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-lg mt-2">
              Парсинг, сравнение и добавление релизов из Zvonko Digital.
            </p>
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mt-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="pages" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Страниц
                  </Label>
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
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="action" className="text-xs text-gray-500 font-mono uppercase tracking-widest">
                    Действие
                  </Label>
                  <select
                    id="action"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value as "parse" | "compare" | "add")}
                    className={`${inputCls} min-w-[180px] cursor-pointer`}
                    disabled={isRunning}
                  >
                    <option value="parse">Парсинг</option>
                    <option value="compare">Сравнение</option>
                    <option value="add">Добавление</option>
                  </select>
                </div>
              </div>
              <Button
                onClick={() => void runParser()}
                disabled={isRunning}
                className="rounded-lg bg-accent-azure text-black hover:bg-sky-400 font-bold shrink-0 inline-flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                    {actionRunningLabel}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
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
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">
          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-accent-azure">schedule</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Последний запуск</p>
            <p className="font-display text-xl text-white mt-2">
              {status?.lastRun ? formatDate(status.lastRun) : "Никогда"}
            </p>
          </div>

          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-primary">flag</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Статус</p>
            <p
              className={`font-display text-xl mt-2 ${
                status?.success ? "text-primary" : status?.lastRun ? "text-destructive" : "text-yellow-500"
              }`}
            >
              {status?.success ? "Успешно" : status?.lastRun ? "Ошибка" : "Не запускался"}
            </p>
          </div>

          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-accent-azure">travel_explore</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Найдено</p>
            <p className="font-display text-2xl text-white mt-2">{status?.stats?.total ?? 0}</p>
          </div>

          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-primary">library_add</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Добавлено</p>
            <p className="font-display text-2xl text-white mt-2">{status?.stats?.added ?? 0}</p>
          </div>

          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-purple-400">layers</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Страниц</p>
            <p className="font-display text-2xl text-white mt-2">
              {status?.pagesProcessed ?? 0}/{status?.totalPages ?? pagesToParse}
            </p>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-4">
            <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
            <span className="material-symbols-outlined text-primary text-2xl">tune</span>
            Режимы работы
          </h2>
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

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-azure/50 to-transparent" />
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-2">
            <span className="w-1.5 h-6 rounded-full bg-accent-azure shrink-0" />
            Расписание автоматического парсинга
          </h2>
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
          <div
            className={`card-glass rounded-2xl border p-6 md:p-8 ${
              status.success ? "border-primary/30" : "border-destructive/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`material-symbols-outlined shrink-0 ${
                  status.success ? "text-primary" : "text-destructive"
                }`}
              >
                {status.success ? "check_circle" : "cancel"}
              </span>
              <div>
                <p className={`font-medium ${status.success ? "text-primary" : "text-destructive"}`}>{status.message}</p>
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
                  <ul className="mt-2 text-sm text-destructive space-y-1">
                    {status.stats.errors.map((err, index) => (
                      <li key={index}>• {err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {lastReleases.length > 0 && (
          <div className="card-glass rounded-2xl border border-white/5 p-0 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="p-6 md:p-8 pb-0">
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-1">
                <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
                Последние обработанные релизы
              </h2>
              <p className="text-sm text-gray-400 mb-4">Релизы из последнего запуска парсера</p>
            </div>
            <div className="table-glass overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Название</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Артист</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Статус</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">UPC</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Жанр</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Площадки</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Дата</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Стр.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastReleases.map((release) => (
                    <TableRow key={release.id} className="table-row-hover border-white/10">
                      <TableCell className="text-white font-medium">
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
                      </TableCell>
                      <TableCell className="text-gray-400">{release.artist}</TableCell>
                      <TableCell>
                        <span className={statusBadgeClass(release.status)}>{release.status}</span>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {release.upc ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-primary text-base">barcode_scanner</span>
                            {release.upc}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">{release.genre || <span className="text-gray-600">—</span>}</TableCell>
                      <TableCell className="text-gray-400 max-w-[12rem] truncate" title={release.platforms}>
                        {release.platforms ? (
                          <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-xs font-mono text-gray-400">
                            {release.platforms}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">{release.date || "—"}</TableCell>
                      <TableCell className="text-gray-400">
                        <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-xs font-mono">
                          {release.page}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <footer className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <span>ROSSEL LABEL ENGINE V2.4 | ADMIN</span>
        </footer>
      </div>
    </Layout>
  )
}
