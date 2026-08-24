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
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge, type ReleaseStatusVariant } from "@/components/ui/status-badge"
import { DashboardFooter } from "@/components/dashboard-footer"

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

/**
 * C-15: бейдж из кита вместо CSS-классов .release-status-badge--*.
 * Маппинг местный — статусы приходят из Koala как есть, общий
 * releaseStatusVariant их набор не покрывает.
 */
function statusVariant(raw: string): ReleaseStatusVariant {
  const s = raw || ""
  if (["Доставлен", "released", "Одобрен"].includes(s)) return "live"
  if (["В доставке", "delivery"].includes(s)) return "delivered"
  if (["Модерируется", "На модерации", "moderation", "scheduled", "Новый", "новый"].includes(s))
    return "moderation"
  if (["Отклонен", "Отклонён", "Снят"].includes(s)) return "rejected"
  return "draft"
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
      <div className="flex justify-center py-16">
          <Spinner label="Загрузка…" />
        </div>
      )
  }

  return (
    
      <div className="space-y-8">
        {/* F-36: шапка парсера — один шаблон с zvonko-parser */}
        <PageHeader
          title="Koala Music Parser"
          subtitle="Импорт релизов из Koala Music: статус последнего запуска и таблица последних записей."
          actions={
            <Button onClick={() => void runParser()} disabled={isRunning} variant="cta" className="rounded-lg">
              {isRunning ? (
                <>
                  <span className="material-symbols-outlined text-lg animate-spin" aria-hidden>progress_activity</span>
                  Парсинг…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" aria-hidden>play_arrow</span>
                  Запустить парсинг
                </>
              )}
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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

          <StatCard label="Добавлено" tone="primary" bgIcon="library_add" value={status?.stats?.added ?? 0} />

          <StatCard label="Обновлено" tone="azure" bgIcon="sync" value={status?.stats?.updated ?? 0} />
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
              <SectionHeader className="mb-1" title="Последние спарсенные релизы" />
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
                    <DataTableHeadCell>BandLink</DataTableHeadCell>
                    <DataTableHeadCell>Дата</DataTableHeadCell>
                  </DataTableHeadRow>
                </DataTableHeader>
                <DataTableBody>
                  {lastReleases.map((release) => (
                    <DataTableRow key={release.koala_id} className="table-row-hover">
                      <DataTableCell className="text-white font-medium">{release.title}</DataTableCell>
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
                      <DataTableCell>
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
                      </DataTableCell>
                      <DataTableCell className="text-gray-400">{release.release_date || "—"}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          </div>
        )}

        <DashboardFooter />
      </div>
    )
}
