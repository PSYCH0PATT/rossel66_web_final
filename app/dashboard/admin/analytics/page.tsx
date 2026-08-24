"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { revalidateStreamAnalytics } from "@/lib/hooks/use-dashboard-fetch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { TrackThinPaidFreeBar } from "@/components/analytics/TrackThinPaidFreeBar"
import {
  AllTracksToggle,
  TrackRowButton,
  visibleTracks,
} from "@/components/analytics/track-top-list"
import { UnmappedArtistsPanel } from "@/components/analytics/unmapped-artists-panel"
import { formatDayMonthUtc } from "@/lib/format-date"
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu"
import { PageHeader } from "@/components/ui/page-header"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { DatePicker } from "@/components/ui/date-picker"
import { FileInput } from "@/components/ui/file-input"
import { Banner } from "@/components/ui/banner"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/ui/empty-state"
import { SkeletonValue } from "@/components/ui/skeleton-presets"
import { SeriesBar } from "@/components/charts/series-bar"
import { mskDateString } from "@/lib/msk-date"
import { analyticsStreamWindow } from "@/lib/stream-window"

const DspStreamChart = dynamic(() => import("@/components/charts/DspStreamChart"), { ssr: false })

const PERIOD_OPTIONS = [
  { value: "7d", label: "Неделя" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "3 месяца" },
  { value: "180d", label: "6 месяцев" },
  { value: "365d", label: "Год" },
  { value: "custom", label: "Выбранный период" },
]

interface Track {
  trackName: string
  trackArtist: string
  isrc: string
}

interface ArtistOption {
  id: string
  label: string
  trackArtist: string
  artistId: string | null
  mappedProfileName: string | null
  mappedUsername: string | null
  totalStreams: number
}

function artistFilterParams(selected: string, artists: ArtistOption[]): URLSearchParams {
  const params = new URLSearchParams()
  if (selected === "all") return params
  const artist = artists.find((a) => a.id === selected)
  if (!artist) return params
  if (artist.artistId) params.set("artistId", artist.artistId)
  else params.set("trackArtist", artist.trackArtist)
  return params
}

interface AnalyticsData {
  streamsByDspDay: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  streamsByDay: Array<{ date: string; streams: number }>
  paidVsFree: Array<{ name: string; value: number }>
  streamsBySource: Array<{ name: string; value: number }>
  streamsByTrack?: Array<{ trackName: string; trackArtist: string; isrc: string; value: number; paid: number; free: number }>
  totalStreams?: number
}

/**
 * F-18: окно периода — общее с дашбордом (lib/stream-window.ts). Пока пресет
 * жил здесь своей копией, дашборд и аналитика считали «30 дней» по-разному.
 */
const getDateRange = analyticsStreamWindow

/** A8: подпись дня в UTC — дата точки календарная, локальный getDate() сдвигал ось */
const formatDate = formatDayMonthUtc

/** «YYYY-MM-DD» → Date для DatePicker: календарь работает с локальной полночью. */
function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

/** Date из DatePicker → «YYYY-MM-DD»: формат, который ждёт API синхронизации. */
function toIsoDate(date?: Date): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const profile = useDashboardProfile()
  const currentUser = profile?.role === "admin" ? profile : null
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncRangeStart, setSyncRangeStart] = useState("2026-03-01")
  const [syncRangeEnd, setSyncRangeEnd] = useState(() => mskDateString())
  const [importResult, setImportResult] = useState<string | null>(null)
  const [unmappedOpen, setUnmappedOpen] = useState(false)
  const [unmappedCount, setUnmappedCount] = useState<number | null>(null)
  /** Скрытый файловый инпут CSV: его дёргает пункт меню «Сервис» (0-в). */
  const csvInputRef = useRef<HTMLInputElement>(null)
  /** C-11: списки треков показывают топ-10, полный набор — по кнопке. */
  const [showAllPaidFree, setShowAllPaidFree] = useState(false)
  const [showAllByStreams, setShowAllByStreams] = useState(false)

  const [artists, setArtists] = useState<ArtistOption[]>([])
  const [selectedArtist, setSelectedArtist] = useState<string>("all")
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrack, setSelectedTrack] = useState<string>("all")
  const [period, setPeriod] = useState("30d")
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [chartMounted, setChartMounted] = useState(false)

  useEffect(() => {
    setChartMounted(true)
  }, [])

  useEffect(() => {
    if (!profile) return
    if (profile.role !== "admin") {
      if (profile.username) {
        router.push(`/dashboard/artist/${profile.username}/dashboard`)
      } else {
        router.push("/dashboard/login")
      }
    }
  }, [profile, router])

  const refreshArtistsAndUnmapped = useCallback(() => {
    fetch("/api/analytics/artists?take=2000")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setArtists(d.artists)
      })
      .catch(console.error)
    fetch("/api/analytics/unmapped-artists?take=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUnmappedCount(d.total)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    refreshArtistsAndUnmapped()
  }, [refreshArtistsAndUnmapped])

  // Загрузка треков при смене артиста
  useEffect(() => {
    const controller = new AbortController()
    // F-PARS-8: сброс делаем СРАЗУ, до ответа сервера. Раньше он был внутри
    // .then(), поэтому loadData успевал уйти с isrc трека ПРОШЛОГО артиста
    // (график мигал «Нет данных»), а ответы для артистов A и B гонялись
    // за setTracks — выигрывал тот, кто ответил последним.
    setSelectedTrack("all")
    setTracks([])

    const params = artistFilterParams(selectedArtist, artists)
    fetch(`/api/analytics/tracks?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (d.success) setTracks(d.tracks)
      })
      .catch(err => {
        if (err?.name !== "AbortError") console.error(err)
      })

    return () => controller.abort()
  }, [selectedArtist, artists])

  // Загрузка данных
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)

    try {
      let startDate: string
      let endDate: string

      if (period === "custom" && customStart && customEnd) {
        // A7: выбранная в календаре дата — локальная полночь; toISOString сдвигал
        // её на день. mskDateString даёт календарную дату в МСК (как ключи данных).
        startDate = mskDateString(customStart)
        endDate = mskDateString(customEnd)
      } else if (period !== "custom") {
        const range = getDateRange(period)
        startDate = range.startDate
        endDate = range.endDate
      } else {
        setLoading(false)
        return
      }

      const params = new URLSearchParams({ startDate, endDate })
      const artistParams = artistFilterParams(selectedArtist, artists)
      artistParams.forEach((v, k) => params.set(k, v))
      if (selectedTrack !== "all") {
        const track = tracks.find(t => t.isrc === selectedTrack)
        if (track) params.set("isrc", track.isrc)
      }

      const res = await fetch(`/api/analytics/streams?${params}`, { signal })
      const json = await res.json()

      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      // F-PARS-8: отменённый запрос — не ошибка, просто фильтр успели сменить
      if ((err as { name?: string })?.name === "AbortError") return
      console.error("Ошибка загрузки аналитики:", err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [period, selectedArtist, selectedTrack, customStart, customEnd, tracks, artists])

  useEffect(() => {
    if (!currentUser) return
    // F-PARS-8: отменяем предыдущий запрос, чтобы его ответ не перезаписал новый
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [currentUser, loadData])

  // Ручной импорт CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/analytics/import-flash", { method: "POST", body: formData })
      const json = await res.json()

      if (json.success) {
        setImportResult(`Импортировано ${json.stats.added} записей, пропущено ${json.stats.skipped} дубликатов`)
        revalidateStreamAnalytics()
        refreshArtistsAndUnmapped()
        loadData()
      } else {
        setImportResult(`Ошибка: ${json.error}`)
      }
    } catch (err) {
      setImportResult(`Ошибка: ${err}`)
    } finally {
      setImporting(false)
      // Сброс input
      e.target.value = ""
    }
  }

  const describeSyncResult = (json: { stats?: Record<string, unknown>; message?: string }) => {
    const stats = (json.stats || {}) as Record<string, unknown>
    const mode = stats.mode as string | undefined
    const fp = Number(stats.filesProcessed || 0)
    const add = Number(stats.totalAdded || 0)
    const sk = Number(stats.totalSkipped || 0)
    const truncated = stats.truncated === true
    const newestAvailable =
      typeof stats.newestAvailable === "string" ? stats.newestAvailable : null
    const serverLagDays =
      typeof stats.serverLagDays === "number" ? stats.serverLagDays : null
    const lagSuffix =
      newestAvailable && serverLagDays !== null && serverLagDays > 0
        ? ` (SFTP отстаёт на ${serverLagDays} дн., новейший файл — ${newestAvailable})`
        : ""
    const truncSuffix = truncated ? " — обработка прервана по общему таймауту" : ""

    if (mode === "range" && stats.dateFrom && stats.dateTo) {
      if (fp === 0) {
        return `Период ${stats.dateFrom}…${stats.dateTo}: файлов на SFTP нет${lagSuffix}.`
      }
      return `Период ${stats.dateFrom}…${stats.dateTo}: файлов ${fp}, добавлено ${add}, пропущено ${sk}${truncSuffix}`
    }
    if (mode === "today") {
      if (fp === 0) {
        return `Сегодня (МСК): на SFTP нет файла rossel_flash за этот день${lagSuffix}.`
      }
      return `Сегодня (МСК): файлов ${fp}, добавлено ${add}, пропущено ${sk}${truncSuffix}`
    }
    if (mode === "all") {
      return `Полный импорт: файлов ${fp}, добавлено ${add}, пропущено ${sk}${truncSuffix}`
    }
    if (mode === "7days") {
      if (fp === 0) {
        return `Последние 7 дней: подходящих файлов нет${lagSuffix}.`
      }
      return `Последние 7 дней: файлов ${fp}, добавлено ${add}, пропущено ${sk}${lagSuffix}${truncSuffix}`
    }
    if (mode === "latest") {
      return `Последний файл: файлов ${fp}, добавлено ${add}, пропущено ${sk}${truncSuffix}`
    }
    return `Готово: файлов ${fp}, добавлено ${add}, пропущено ${sk}${truncSuffix}`
  }

  /** Синхронизация rossel_flash с SFTP (прокси → /api/cron/analytics-flash). */
  const runFlashSync = async (body: { mode?: string; startDate?: string; endDate?: string }) => {
    setSyncing(true)
    setImportResult(null)

    try {
      const res = await fetch("/api/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (json.success) {
        setImportResult(describeSyncResult(json))
        setSyncDialogOpen(false)
        loadData()
        refreshArtistsAndUnmapped()
        const params = artistFilterParams(selectedArtist, artists)
        fetch(`/api/analytics/tracks?${params}`).then(r => r.json()).then(d => { if (d.success) setTracks(d.tracks) })
      } else {
        setImportResult(`Ошибка: ${json.error || json.details || "Unknown"}`)
      }
    } catch (err) {
      setImportResult(`Ошибка: ${err}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncRange = () => {
    const s = syncRangeStart?.trim()
    const e = syncRangeEnd?.trim()
    if (!s || !e) {
      setImportResult("Ошибка: укажите даты «с» и «по»")
      return
    }
    if (s > e) {
      setImportResult("Ошибка: дата «с» не может быть позже «по»")
      return
    }
    void runFlashSync({ startDate: s, endDate: e })
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      )
  }

  const totalStreams = data?.totalStreams ?? data?.streamsByDay.reduce((s, d) => s + d.streams, 0) ?? 0
  const totalPaid = data?.paidVsFree.find(p => p.name === "Платные")?.value || 0
  const totalFree = data?.paidVsFree.find(p => p.name === "Бесплатные")?.value || 0
  const tracksForChart = (data?.streamsByTrack ?? []).slice()
  const visiblePaidFree = visibleTracks(tracksForChart, showAllPaidFree)
  const visibleByStreams = visibleTracks(tracksForChart, showAllByStreams)

  return (
    
      <div className="space-y-8">
        {/* TopAppBar Mapping */}
        <PageHeader
          rowClassName="md:flex-col md:items-start md:gap-4 lg:flex-row lg:items-center lg:gap-6"
          actionsClassName="w-full min-w-0 shrink lg:w-auto"
          title="АНАЛИТИКА"
          meta={
            /* 0-в: синк, CSV и сопоставление — аварийные операции «когда
               ломается», на поверхности экрана их нет. Счётчик непривязанных
               не теряется: он бейджем на самом триггере (0-в п.2). */
            <div className="mt-3 flex items-center gap-2">
              <ActionMenu
                kind="service"
                align="start"
                count={unmappedCount ?? 0}
                countLabel="Непривязанных артистов"
              >
                <ActionMenuItem
                  icon="sync"
                  description="Забрать свежие файлы rossel_flash"
                  disabled={syncing}
                  onSelect={(event) => {
                    event.preventDefault()
                    setSyncRangeEnd(mskDateString())
                    setSyncDialogOpen(true)
                  }}
                >
                  {syncing ? "Синхронизация…" : "Синхронизировать"}
                </ActionMenuItem>
                <ActionMenuItem
                  icon="upload_file"
                  description="Ручной импорт, когда синк не прошёл"
                  disabled={importing}
                  onSelect={(event) => {
                    event.preventDefault()
                    csvInputRef.current?.click()
                  }}
                >
                  {importing ? "Импорт…" : "Загрузить CSV"}
                </ActionMenuItem>
                <ActionMenuItem
                  icon="link"
                  description={
                    unmappedCount && unmappedCount > 0
                      ? `Без профиля: ${unmappedCount}`
                      : "Все имена из отчётов привязаны"
                  }
                  onSelect={(event) => {
                    event.preventDefault()
                    setUnmappedOpen(true)
                  }}
                >
                  Сопоставить артистов
                </ActionMenuItem>
              </ActionMenu>
              {/* Сам input остаётся в DOM: пункт меню дёргает его по ref. */}
              <FileInput
                ref={csvInputRef}
                accept=".csv"
                onChange={handleImport}
                disabled={importing}
                containerClassName="hidden"
                showFileName={false}
              />
            </div>
          }
          actions={
          /* фильтры — на мобилке сетка 50/50 + период на всю ширину; с md — ряд */
          <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 md:contents">
            {/* Artist select — pill style */}
            <Select value={selectedArtist} onValueChange={setSelectedArtist}>
              <SelectTrigger className={`h-10 px-3 text-[10px] font-bold uppercase tracking-widest rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-colors data-[placeholder]:text-gray-500 w-full min-w-0 md:h-9 md:w-auto md:min-w-[130px] ${
                selectedArtist !== "all"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-white/10 bg-white/5 text-gray-300 hover:border-white/15 hover:bg-white/[0.07] hover:text-emerald-400"
              }`}>
                <SelectValue placeholder="Все артисты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">
                  Все артисты
                </SelectItem>
                {artists.map((a) => (
                  <SelectItem
                    key={a.id}
                    value={a.id}
                    className="text-[10px] font-bold uppercase tracking-widest"
                  >
                    <span className="flex items-center gap-2">
                      <span>{a.label}</span>
                      {a.artistId ? (
                        a.mappedUsername ? (
                          <span className="text-gray-500 normal-case">
                            @{a.mappedUsername}
                          </span>
                        ) : null
                      ) : (
                        <span className="text-amber-500/80 text-[9px]">без профиля</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Track select — pill style */}
            <Select value={selectedTrack} onValueChange={setSelectedTrack}>
              <SelectTrigger className={`h-10 px-3 text-[10px] font-bold uppercase tracking-widest rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-colors data-[placeholder]:text-gray-500 w-full min-w-0 md:h-9 md:w-auto md:min-w-[120px] ${
                selectedTrack !== "all"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-white/10 bg-white/5 text-gray-300 hover:border-white/15 hover:bg-white/[0.07] hover:text-emerald-400"
              }`}>
                <SelectValue placeholder="Все треки" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[10px] font-bold uppercase tracking-widest">
                  Все треки
                </SelectItem>
                {tracks.map(t => (
                  <SelectItem key={t.isrc} value={t.isrc} className="text-[10px] font-bold uppercase tracking-widest">
                    {t.trackName} — {t.trackArtist}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period — mobile: полная ширина под двумя селектами */}
            <div className="col-span-2 min-w-0 md:hidden">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-colors hover:border-white/15 hover:bg-white/[0.07] data-[placeholder]:text-gray-500 md:h-9">
                  <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: "7d", label: "7 дней" },
                    { value: "30d", label: "30 дней" },
                    { value: "90d", label: "90 дней" },
                    { value: "180d", label: "180 дней" },
                    { value: "365d", label: "Год" },
                    { value: "custom", label: "Период" },
                  ].map((p) => (
                    <SelectItem
                      key={p.value}
                      value={p.value}
                      className="text-[10px] font-bold uppercase tracking-widest"
                    >
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>

            {/* Period pills — tablet+ */}
            <SegmentedControl
              aria-label="Период"
              className="hidden md:inline-flex"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: "7d", label: "7Д" },
                { value: "30d", label: "30Д" },
                { value: "90d", label: "90Д" },
                { value: "180d", label: "180Д" },
                { value: "365d", label: "Год" },
                { value: "custom", label: "Период" },
              ]}
            />

            {/* Custom date pickers */}
            {period === "custom" && (
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                <DatePicker value={customStart} onChange={setCustomStart} placeholder="ОТ" />
                <DatePicker value={customEnd} onChange={setCustomEnd} placeholder="ДО" />
              </div>
            )}
          </div>
          }
        />

        <Dialog
          open={syncDialogOpen}
          onOpenChange={(open) => {
            setSyncDialogOpen(open)
            if (open) setSyncRangeEnd(mskDateString())
          }}
        >
          <DialogContent className="max-w-md border border-white/10 bg-surface-raised text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:rounded-2xl [&>button]:text-gray-400 [&>button]:hover:text-white">
            <DialogHeader>
              <DialogTitle className="font-display text-xl uppercase tracking-tight text-white">
                Синхронизация SFTP
              </DialogTitle>
              <DialogDescription className="text-left text-xs font-mono uppercase tracking-widest text-gray-500">
                Файлы <span className="text-gray-400">rossel_flash_YYYY_MM_DD.csv</span>. «Сегодня» — календарный день по Москве (как на сервере отчётов).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-1">
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "today" })}
                  className="h-auto flex-col items-start gap-0 rounded-lg border-white/10 bg-surface-overlay px-4 py-3 text-left hover:border-primary/30 hover:bg-primary/5"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Сегодня (МСК)</span>
                  <span className="mt-1 block text-[11px] font-mono text-gray-500">
                    Один дневной файл: {mskDateString()}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "7days" })}
                  className="h-auto flex-col items-start gap-0 rounded-lg border-white/10 bg-surface-overlay px-4 py-3 text-left hover:border-emerald-500/20 hover:bg-emerald-500/5"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Последние 7 дней</span>
                  <span className="mt-1 block text-[11px] font-mono text-gray-500">
                    Как в cron: все дни с задержкой дополнений по площадкам
                  </span>
                </Button>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-5 w-1 rounded-full bg-accent-azure" aria-hidden />
                  За период
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <DatePicker
                    value={parseIsoDate(syncRangeStart)}
                    onChange={(date) => setSyncRangeStart(toIsoDate(date))}
                    placeholder="дд.мм.гггг"
                    className="min-w-[9.5rem] font-mono text-gray-200"
                  />
                  <span className="text-[10px] font-mono uppercase text-gray-600">—</span>
                  <DatePicker
                    value={parseIsoDate(syncRangeEnd)}
                    onChange={(date) => setSyncRangeEnd(toIsoDate(date))}
                    placeholder="дд.мм.гггг"
                    className="min-w-[9.5rem] font-mono text-gray-200"
                  />
                </div>
                <Button
                  type="button"
                  variant="cta"
                  disabled={syncing}
                  onClick={handleSyncRange}
                  className="mt-4 w-full transition-all hover:scale-[1.02]"
                >
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
                  Импорт за период
                </Button>
              </div>

              <Banner variant="warning" icon={null} className="flex-col rounded-xl border-status-warning/20 bg-status-warning/5 p-4">
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Полный импорт скачает и обработает все доступные даты на SFTP. Дубликаты в БД не создаются, но это долго и нагружает диск.
                </p>
                <Button
                  type="button"
                  variant="warning-outline"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "all" })}
                  className="mt-3 w-full text-[10px] font-mono uppercase tracking-widest"
                >
                  Импорт всех файлов
                </Button>
              </Banner>
            </div>
          </DialogContent>
        </Dialog>

        {importResult ? (
          <Banner
            variant={importResult.startsWith('Ошибка') ? 'danger' : 'success'}
            className="font-mono"
          >
            {importResult}
          </Banner>
        ) : null}

        {/* HERO SUMMARY CARD */}
        <div className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-xl relative overflow-hidden p-4 sm:p-6 flex min-h-[100px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {/* Animated waveform bars */}
          <div className="absolute inset-0 flex items-end justify-center gap-[3px] px-6 pb-0 pointer-events-none overflow-hidden opacity-[0.07]">
            {Array.from({ length: 48 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-t-sm bg-emerald-400 flex-shrink-0"
                style={{
                  height: `${30 + Math.sin(i * 0.7) * 20 + Math.cos(i * 0.3) * 15}%`,
                  animationDelay: `${i * 0.06}s`,
                  animation: `analyticsWave ${1.2 + (i % 5) * 0.3}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
          <style>{`
            @keyframes analyticsWave {
              from { transform: scaleY(0.4); }
              to   { transform: scaleY(1); }
            }
          `}</style>

          {/* Left — total */}
          <div className="relative z-10 min-w-0 shrink">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Общее число стримов</h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* F-54: пока идёт загрузка — скелетон, а не честный на вид «0». */}
              {loading ? (
                <SkeletonValue className="w-40 sm:h-10" />
              ) : (
                <>
                  <span className="text-3xl font-black leading-none text-white font-display uppercase tracking-tight drop-shadow-[0_2px_15px_rgba(255,255,255,0.1)] tabular-nums sm:text-4xl">
                    {totalStreams.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-emerald-400 flex shrink-0 items-center">
                    <span className="material-symbols-outlined text-[14px] leading-none">trending_up</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Paid / free — под итогом на узком экране, в ряд на sm+ */}
          <div className="relative z-10 flex w-full min-w-0 flex-wrap items-stretch justify-between gap-4 border-t border-white/5 pt-4 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
            <div className="min-w-0 flex-1 sm:flex-none sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Платные</p>
              {loading ? (
                <SkeletonValue className="h-6 w-20 sm:ml-auto" />
              ) : (
                <p className="text-xl font-black leading-none text-emerald-400 font-display tabular-nums sm:text-2xl">
                  {totalPaid.toLocaleString("ru-RU")}
                </p>
              )}
            </div>
            <div className="hidden w-px self-stretch bg-white/10 sm:block" aria-hidden />
            <div className="min-w-0 flex-1 text-right sm:flex-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Бесплатные</p>
              {loading ? (
                <SkeletonValue className="ml-auto h-6 w-20" />
              ) : (
                <p className="text-xl font-black leading-none text-gray-400 font-display tabular-nums sm:text-2xl">
                  {totalFree.toLocaleString("ru-RU")}
                </p>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner />
          </div>
        ) : !data || (data.streamsByDay.length === 0 && data.paidVsFree.every(p => p.value === 0)) ? (
          <Card className="stat-card-glass bg-surface-raised/60 backdrop-blur-xl border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl relative overflow-hidden">
            <CardContent className="p-0">
              <EmptyState
                icon="bar_chart"
                title="Нет данных"
                description="Импортируйте CSV файл из rossel_flash или дождитесь автоматического импорта в 20:00 МСК"
                className="px-6"
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {/* Chart 1: Streams by DSP */}
            <Card className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-2xl relative overflow-hidden flex flex-col p-5">
              <CardHeader className="p-0 mb-4 flex-shrink-0">
                <CardTitle className="font-card-heading font-bold tracking-[0.08em] uppercase text-white text-base leading-tight">Стримы по площадкам</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <div className="h-[290px] w-full">
                  {chartMounted ? (
                    <DspStreamChart data={data.streamsByDspDay} dsps={data.dsps} formatDate={formatDate} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Загрузка графика…</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Paid vs Free */}
            <Card className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-2xl relative overflow-hidden flex flex-col p-5">
              <CardHeader className="p-0 mb-1 flex-shrink-0">
                <CardTitle className="font-card-heading font-bold tracking-[0.08em] uppercase text-white text-base leading-tight">Платные / Бесплатные</CardTitle>
                <p className="text-[10px] uppercase font-card-heading text-gray-500 tracking-widest mt-0.5">По трекам</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col mt-3">
                {/* C-11 (F-38/F-39): вместо вложенного скролла на 179 строк —
                    топ-10 и раскрытие по кнопке. Клик по треку показывает
                    статистику одного трека (0-д п.5). */}
                <div className="flex flex-col gap-1.5">
                  {tracksForChart.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                  ) : (
                    visiblePaidFree.map((item, idx) => {
                      const total = item.paid + item.free
                      const pctPaid = total > 0 ? (item.paid / total) * 100 : 0
                      const pctFree = total > 0 ? (item.free / total) * 100 : 0
                      const label = `${item.trackName}${item.trackArtist ? ` — ${item.trackArtist}` : ''}`
                      return (
                        <TrackRowButton key={`pf-${item.isrc || idx}`} isrc={item.isrc} label={label} onSelect={setSelectedTrack}>
                          <span className="flex w-full flex-col gap-1 py-1">
                            <span className="flex w-full items-center justify-between">
                              <span className="max-w-[55%] truncate font-card-heading text-[11px] font-semibold text-gray-300 group-hover:text-white" title={label}>{label}</span>
                              <span className="flex shrink-0 gap-2">
                                <span className="font-card-heading text-[11px] font-bold tabular-nums text-emerald-400">{item.paid > 0 ? `${pctPaid.toFixed(0)}%` : ''}</span>
                                <span className="font-card-heading text-[11px] font-bold tabular-nums text-gray-500">{item.free > 0 ? `${pctFree.toFixed(0)}%` : ''}</span>
                              </span>
                            </span>
                            <TrackThinPaidFreeBar paid={item.paid} free={item.free} heightClass="h-[4px]" />
                          </span>
                        </TrackRowButton>
                      )
                    })
                  )}
                </div>
                <AllTracksToggle
                  total={tracksForChart.length}
                  expanded={showAllPaidFree}
                  onToggle={() => setShowAllPaidFree((v) => !v)}
                />
              </CardContent>
            </Card>

            {/* Chart 3: Streams by track */}
            <Card className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-2xl relative overflow-hidden flex flex-col p-5">
              <CardHeader className="p-0 mb-1 flex-shrink-0">
                <CardTitle className="font-card-heading font-bold tracking-[0.08em] uppercase text-white text-base leading-tight">Прослушивания по трекам</CardTitle>
                <p className="text-[10px] uppercase font-card-heading text-gray-500 tracking-widest mt-0.5">Всего: {tracksForChart.length} треков</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col mt-3">
                {/* C-11 (F-38/F-39): второй scroll-trap — тот же топ-10 с раскрытием. */}
                <div className="flex flex-col">
                  {tracksForChart.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                  ) : (
                    visibleByStreams.map((item, idx) => {
                      const maxVal = tracksForChart[0]?.value || 1
                      const pct = (item.value / maxVal) * 100
                      const label = `${item.trackName}${item.trackArtist ? ` — ${item.trackArtist}` : ''}`
                      return (
                        <TrackRowButton key={item.isrc || idx} isrc={item.isrc} label={label} onSelect={setSelectedTrack}>
                          <span className="flex w-full items-center gap-3 py-1.5">
                            <span className="w-[130px] shrink-0 truncate font-card-heading text-[11px] font-medium text-gray-400 group-hover:text-gray-200" title={label}>{label}</span>
                            <SeriesBar percent={pct} index={idx} className="min-w-0 flex-1 self-center" />
                            <span className="w-[66px] shrink-0 text-right font-card-heading text-[11px] font-semibold tabular-nums text-white">{item.value.toLocaleString('ru-RU')}</span>
                          </span>
                        </TrackRowButton>
                      )
                    })
                  )}
                </div>
                <AllTracksToggle
                  total={tracksForChart.length}
                  expanded={showAllByStreams}
                  onToggle={() => setShowAllByStreams((v) => !v)}
                />
              </CardContent>
            </Card>
            
            {/* Chart 4: Streams by source */}
            <Card className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-2xl relative overflow-hidden flex flex-col p-5">
              <CardHeader className="p-0 mb-1 flex-shrink-0">
                <CardTitle className="font-card-heading font-bold tracking-[0.08em] uppercase text-white text-base leading-tight">Стримы по источникам</CardTitle>
                <p className="text-[10px] uppercase font-card-heading text-gray-500 tracking-widest mt-0.5">Детализация</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col mt-3">
                <div className="flex flex-col justify-between h-[290px]">
                  {data.streamsBySource.map((item, idx) => {
                    const maxVal = data.streamsBySource[0]?.value || 1
                    const pct = (item.value / maxVal) * 100
                    return (
                      <div key={item.name} className="flex flex-col flex-shrink-0 group py-1 border-b border-white/[0.03] last:border-0">
                        <div className="flex justify-between items-center w-full">
                          <span className="text-[11px] font-card-heading font-bold text-gray-300 uppercase tracking-wider group-hover:text-white transition-colors">{item.name}</span>
                          <span className="text-[11px] text-white font-card-heading font-semibold shrink-0 tabular-nums">{item.value.toLocaleString("ru-RU")}</span>
                        </div>
                        <SeriesBar percent={pct} index={idx} className="mt-1 w-full" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <UnmappedArtistsPanel
          open={unmappedOpen}
          onOpenChange={setUnmappedOpen}
          onLinked={() => {
            refreshArtistsAndUnmapped()
            loadData()
          }}
        />
      </div>
    )
}
