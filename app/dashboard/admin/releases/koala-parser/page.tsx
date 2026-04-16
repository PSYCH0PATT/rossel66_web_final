"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
}

interface KoalaRelease {
  koala_id: string
  title: string
  artist: string
  status: string
  release_date: string | null
  upc: string | null
  bandlink_url: string | null
  cover_url: string | null
  isrc_codes: string[]
  parsed_at: string
}

function statusBadgeClass(raw: string): string {
  const s = raw || ""
  if (["Доставлен", "released", "Одобрен"].includes(s)) return "release-status-badge release-status-badge--live"
  if (["В доставке", "delivery"].includes(s)) return "release-status-badge release-status-badge--delivered"
  if (["Модерируется", "На модерации", "moderation", "scheduled", "Новый", "новый"].includes(s))
    return "release-status-badge release-status-badge--moderation"
  if (["Отклонен", "Отклонён", "Снят"].includes(s)) return "release-status-badge release-status-badge--rejected"
  return "release-status-badge release-status-badge--draft"
}

export default function KoalaParserPage() {
  const [status, setStatus] = useState<ParserStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [lastReleases, setLastReleases] = useState<KoalaRelease[]>([])

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/koala-parser")
      const data = await response.json()

      if (data.success && data.status) {
        setStatus(data.status)
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
      const response = await fetch("/api/koala-parser", {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        setStatus({
          lastRun: new Date().toISOString(),
          success: true,
          stats: data.stats,
          message: data.message,
        })

        if (data.releases) {
          setLastReleases(data.releases)
        }
      } else {
        setStatus({
          lastRun: new Date().toISOString(),
          success: false,
          stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [data.error || "Неизвестная ошибка"] },
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
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/releases" className="hover:text-primary">
              Релизы
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Koala Parser</span>
          </div>
          <div className="border-b border-white/5 pb-8 flex flex-col gap-4 lg:flex-row items-start lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white uppercase tracking-tight">
                Koala Music Parser
              </h1>
              <p className="text-sm text-gray-400 font-light max-w-lg mt-2">
                Импорт релизов из Koala Music: статус последнего запуска и таблица последних записей.
              </p>
            </div>
            <Button
              onClick={() => void runParser()}
              disabled={isRunning}
              className="rounded-lg bg-primary text-black hover:bg-emerald-400 font-bold shrink-0 inline-flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
            >
              {isRunning ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  Парсинг…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  Запустить парсинг
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-accent-azure">schedule</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Последний запуск</p>
            <p className="font-display text-2xl text-white mt-2">
              {status?.lastRun ? formatDate(status.lastRun) : "Никогда"}
            </p>
          </div>

          <div className="stat-card-glass p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined stat-dash-bg-icon text-primary">flag</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Статус</p>
            <p
              className={`font-display text-2xl mt-2 ${
                status?.success ? "text-primary" : status?.lastRun ? "text-destructive" : "text-yellow-500"
              }`}
            >
              {status?.success ? "Успешно" : status?.lastRun ? "Ошибка" : "Не запускался"}
            </p>
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
              <span className="material-symbols-outlined stat-dash-bg-icon text-accent-azure">sync</span>
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Обновлено</p>
            <p className="font-display text-2xl text-white mt-2">{status?.stats?.updated ?? 0}</p>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-2">
            <span className="w-1.5 h-6 rounded-full bg-primary shrink-0" />
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
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-azure/50 to-transparent" />
            <div className="p-6 md:p-8 pb-0">
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-1">
                <span className="w-1.5 h-6 rounded-full bg-accent-azure shrink-0" />
                Последние спарсенные релизы
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
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">BandLink</TableHead>
                    <TableHead className="text-gray-500 font-mono text-xs uppercase tracking-widest">Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastReleases.map((release) => (
                    <TableRow key={release.koala_id} className="table-row-hover border-white/10">
                      <TableCell className="text-white font-medium">{release.title}</TableCell>
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
                      <TableCell>
                        {release.bandlink_url ? (
                          <a
                            href={release.bandlink_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent-azure hover:text-primary text-sm"
                          >
                            <span className="material-symbols-outlined text-base">link</span>
                            BandLink
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400">{release.release_date || "—"}</TableCell>
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
