"use client"

import { useEffect, useState, useCallback } from "react"
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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BarChart3, CalendarIcon, Loader2, TrendingUp } from "lucide-react"
import dynamic from "next/dynamic"
import { TrackThinPaidFreeBar } from "@/components/analytics/TrackThinPaidFreeBar"
import TrackPaidFreeDistribution from "@/components/analytics/TrackPaidFreeDistribution"
import { UnmappedArtistsPanel, UnmappedArtistsTrigger } from "@/components/analytics/unmapped-artists-panel"

const DspStreamChart = dynamic(() => import("@/components/charts/DspStreamChart"), { ssr: false })

const PERIOD_OPTIONS = [
  { value: "7d", label: "Неделя" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "3 месяца" },
  { value: "180d", label: "6 месяцев" },
  { value: "365d", label: "Год" },
  { value: "custom", label: "Выбранный период" },
]

const BAR_COLORS = {
  paid: "#10b981",
  free: "#6b7280",
}

const SOURCE_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7",
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

/** Календарная дата в Europe/Moscow (совпадает с именами rossel_flash_YYYY_MM_DD.csv). */
function mskDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case "7d": start.setDate(end.getDate() - 7); break
    case "30d": start.setDate(end.getDate() - 30); break
    case "90d": start.setDate(end.getDate() - 90); break
    case "180d": start.setDate(end.getDate() - 180); break
    case "365d": start.setDate(end.getDate() - 365); break
    default: start.setDate(end.getDate() - 30); break
  }

  return {
    startDate: mskDateString(start),
    endDate: mskDateString(end),
  }
}

function formatDate(dateStr: any) {
  const d = new Date(String(dateStr))
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`
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
    const params = artistFilterParams(selectedArtist, artists)

    fetch(`/api/analytics/tracks?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTracks(d.tracks)
        setSelectedTrack("all") // сброс при смене артиста
      })
      .catch(console.error)
  }, [selectedArtist, artists])

  // Загрузка данных
  const loadData = useCallback(async () => {
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

      const res = await fetch(`/api/analytics/streams?${params}`)
      const json = await res.json()

      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error("Ошибка загрузки аналитики:", err)
    } finally {
      setLoading(false)
    }
  }, [period, selectedArtist, selectedTrack, customStart, customEnd, tracks, artists])

  useEffect(() => {
    if (currentUser) loadData()
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
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )
  }

  const totalStreams = data?.totalStreams ?? data?.streamsByDay.reduce((s, d) => s + d.streams, 0) ?? 0
  const totalPaid = data?.paidVsFree.find(p => p.name === "Платные")?.value || 0
  const totalFree = data?.paidVsFree.find(p => p.name === "Бесплатные")?.value || 0
  const tracksForChart = (data?.streamsByTrack ?? []).slice()

  return (
    
      <div className="space-y-6">
        {/* TopAppBar Mapping */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-white/5">
          {/* Left: breadcrumb + title + admin actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="flex items-center text-xs text-gray-500 uppercase tracking-widest space-x-2 mb-1">
              <span className="hover:text-primary cursor-pointer transition-colors">ДАШБОРД</span>
              <span className="material-symbols-outlined text-[10px] mx-1">chevron_right</span>
              <span className="text-white">Analytics</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight uppercase">АНАЛИТИКА</h1>
            <nav className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                className="text-[10px] text-gray-500 hover:text-white hover:bg-[#141414] uppercase font-bold tracking-wider px-2 h-7"
                onClick={() => {
                  setSyncRangeEnd(mskDateString())
                  setSyncDialogOpen(true)
                }}
                disabled={syncing}
              >
                {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                Синхронизировать
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
                <Button variant="ghost" className="text-[10px] text-gray-500 hover:text-white hover:bg-[#141414] uppercase font-bold tracking-wider px-2 h-7" asChild disabled={importing}>
                  <span>{importing ? <Loader2 className="h-3 w-3 mr-1 animate-spin inline" /> : null}Загрузить CSV</span>
                </Button>
              </label>
              <UnmappedArtistsTrigger count={unmappedCount} onOpen={() => setUnmappedOpen(true)} />
            </nav>
          </div>

          {/* Right: filters — на мобилке сетка 50/50 + период на всю ширину; с md — ряд */}
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
                    { value: "custom", label: "Свой период" },
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
            <div className="hidden rounded-xl border border-white/10 bg-white/5 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md md:flex">
              {[
                { value: "7d", label: "7Д" },
                { value: "30d", label: "30Д" },
                { value: "90d", label: "90Д" },
                { value: "180d", label: "180Д" },
                { value: "365d", label: "Год" },
                { value: "custom", label: "Custom" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 min-w-[max-content] text-[10px] font-bold uppercase tracking-widest transition-colors rounded-md ${
                    period === p.value
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-gray-500 hover:text-emerald-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom date pickers */}
            {period === "custom" && (
              <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="bg-[#141414]/60 backdrop-blur-xl border border-white/5 text-gray-300 text-xs uppercase shadow-[0_4px_20px_rgba(0,0,0,0.2)] h-9">
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customStart ? customStart.toLocaleDateString("ru-RU") : "ОТ"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customStart} onSelect={setCustomStart} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="bg-[#141414]/60 backdrop-blur-xl border border-white/5 text-gray-300 text-xs uppercase shadow-[0_4px_20px_rgba(0,0,0,0.2)] h-9">
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {customEnd ? customEnd.toLocaleDateString("ru-RU") : "ДО"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </header>

        <Dialog
          open={syncDialogOpen}
          onOpenChange={(open) => {
            setSyncDialogOpen(open)
            if (open) setSyncRangeEnd(mskDateString())
          }}
        >
          <DialogContent className="max-w-md border border-white/10 bg-[#141414] text-white shadow-[0_4px_30px_rgba(0,0,0,0.5)] sm:rounded-2xl [&>button]:text-gray-400 [&>button]:hover:text-white">
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
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "today" })}
                  className="rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Сегодня (МСК)</span>
                  <span className="mt-1 block text-[11px] font-mono text-gray-500">
                    Один дневной файл: {mskDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "7days" })}
                  className="rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-left transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/5 disabled:opacity-50"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Последние 7 дней</span>
                  <span className="mt-1 block text-[11px] font-mono text-gray-500">
                    Как в cron: все дни с задержкой дополнений по площадкам
                  </span>
                </button>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-5 w-1 rounded-full bg-accent-azure" aria-hidden />
                  За период
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={syncRangeStart}
                    onChange={(e) => setSyncRangeStart(e.target.value)}
                    className="h-9 min-w-[9.5rem] rounded-lg border border-white/10 bg-[#0a0a0a] px-2 text-xs font-mono text-gray-200 focus:border-primary/40 focus:outline-none"
                  />
                  <span className="text-[10px] font-mono uppercase text-gray-600">—</span>
                  <input
                    type="date"
                    value={syncRangeEnd}
                    onChange={(e) => setSyncRangeEnd(e.target.value)}
                    className="h-9 min-w-[9.5rem] rounded-lg border border-white/10 bg-[#0a0a0a] px-2 text-xs font-mono text-gray-200 focus:border-primary/40 focus:outline-none"
                  />
                </div>
                <Button
                  type="button"
                  disabled={syncing}
                  onClick={handleSyncRange}
                  className="mt-4 w-full bg-[#10b981] font-bold text-black shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:bg-emerald-400 hover:scale-[1.02] transition-all"
                >
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
                  Импорт за период
                </Button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[11px] leading-relaxed text-amber-200/90">
                  Полный импорт скачает и обработает все доступные даты на SFTP. Дубликаты в БД не создаются, но это долго и нагружает диск.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncing}
                  onClick={() => void runFlashSync({ mode: "all" })}
                  className="mt-3 w-full border-amber-500/30 bg-transparent text-[10px] font-mono uppercase tracking-widest text-amber-200/90 hover:bg-amber-500/10 hover:text-amber-100"
                >
                  Импорт всех файлов
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {importResult ? (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm font-mono ${
              importResult.startsWith('Ошибка')
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {importResult}
          </div>
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
              <span className="text-3xl font-black leading-none text-white font-display uppercase tracking-tight drop-shadow-[0_2px_15px_rgba(255,255,255,0.1)] tabular-nums sm:text-4xl">
                {totalStreams.toLocaleString("ru-RU")}
              </span>
              <span className="text-emerald-400 flex shrink-0 items-center">
                <span className="material-symbols-outlined text-[14px] leading-none">trending_up</span>
              </span>
            </div>
          </div>

          {/* Paid / free — под итогом на узком экране, в ряд на sm+ */}
          <div className="relative z-10 flex w-full min-w-0 flex-wrap items-stretch justify-between gap-4 border-t border-white/5 pt-4 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
            <div className="min-w-0 flex-1 sm:flex-none sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Платные</p>
              <p className="text-xl font-black leading-none text-emerald-400 font-display tabular-nums sm:text-2xl">
                {totalPaid.toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="hidden w-px self-stretch bg-white/10 sm:block" aria-hidden />
            <div className="min-w-0 flex-1 text-right sm:flex-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Бесплатные</p>
              <p className="text-xl font-black leading-none text-gray-400 font-display tabular-nums sm:text-2xl">
                {totalFree.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : !data || (data.streamsByDay.length === 0 && data.paidVsFree.every(p => p.value === 0)) ? (
          <Card className="stat-card-glass bg-[#141414]/60 backdrop-blur-xl border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl relative overflow-hidden">
            <CardContent className="py-16 text-center px-6">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-500 mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-white tracking-wide">Нет данных</h3>
              <p className="text-gray-400 mt-2 text-sm">Импортируйте CSV файл из rossel_flash или дождитесь автоматического импорта в 20:00 МСК</p>
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
                <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 h-[290px]">
                  {tracksForChart.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                  ) : (
                    tracksForChart.map((item, idx) => {
                      const total = item.paid + item.free
                      const pctPaid = total > 0 ? (item.paid / total) * 100 : 0
                      const pctFree = total > 0 ? (item.free / total) * 100 : 0
                      const label = `${item.trackName}${item.trackArtist ? ` — ${item.trackArtist}` : ''}`
                      return (
                        <div key={`pf-${item.isrc || idx}`} className="flex flex-col flex-shrink-0 gap-1 group py-1 border-b border-white/[0.03] last:border-0">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[11px] font-card-heading font-semibold text-gray-300 truncate max-w-[55%] group-hover:text-white transition-colors" title={label}>{label}</span>
                            <div className="flex gap-2 shrink-0">
                              <span className="text-[11px] text-emerald-400 font-card-heading font-bold tabular-nums">{item.paid > 0 ? `${pctPaid.toFixed(0)}%` : ''}</span>
                              <span className="text-[11px] text-gray-500 font-card-heading font-bold tabular-nums">{item.free > 0 ? `${pctFree.toFixed(0)}%` : ''}</span>
                            </div>
                          </div>
                          <TrackThinPaidFreeBar paid={item.paid} free={item.free} heightClass="h-[4px]" />
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Chart 3: Streams by track */}
            <Card className="card-glass border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)] rounded-2xl relative overflow-hidden flex flex-col p-5">
              <CardHeader className="p-0 mb-1 flex-shrink-0">
                <CardTitle className="font-card-heading font-bold tracking-[0.08em] uppercase text-white text-base leading-tight">Прослушивания по трекам</CardTitle>
                <p className="text-[10px] uppercase font-card-heading text-gray-500 tracking-widest mt-0.5">Всего: {tracksForChart.length} треков</p>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col mt-3">
                <div className="flex flex-col gap-0 overflow-y-auto pr-1 h-[290px]">
                  {tracksForChart.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                  ) : (
                    tracksForChart.map((item, idx) => {
                      const maxVal = tracksForChart[0]?.value || 1
                      const pct = (item.value / maxVal) * 100
                      const label = `${item.trackName}${item.trackArtist ? ` — ${item.trackArtist}` : ''}`
                      return (
                        <div key={item.isrc || idx} className="flex flex-col flex-shrink-0 group py-1.5 border-b border-white/[0.03] last:border-0">
                          <div className="flex items-center gap-3 w-full">
                            <span className="text-[11px] font-card-heading font-medium text-gray-400 truncate shrink-0 w-[130px] group-hover:text-gray-200 transition-colors" title={label}>{label}</span>
                            <div className="flex-1 min-w-0 h-[3px] bg-gray-800/80 rounded-full overflow-hidden self-center relative">
                              <div
                                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                                  boxShadow: `0 0 6px ${SOURCE_COLORS[idx % SOURCE_COLORS.length]}50`
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-white font-card-heading font-semibold shrink-0 w-[66px] text-right tabular-nums">{item.value.toLocaleString('ru-RU')}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
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
                        <div className="w-full h-[3px] bg-gray-800/80 rounded-full overflow-hidden mt-1 relative">
                          <div
                            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                              boxShadow: `0 0 6px ${SOURCE_COLORS[idx % SOURCE_COLORS.length]}50`
                            }}
                          />
                        </div>
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
