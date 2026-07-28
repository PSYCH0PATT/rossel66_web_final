"use client"

import { useEffect, useState, useCallback, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BarChart3, CalendarIcon, Loader2 } from "lucide-react"
import { TrackThinPaidFreeBar } from "@/components/analytics/TrackThinPaidFreeBar"
import { formatDayMonthUtc } from "@/lib/format-date"

const DspStreamChart = dynamic(() => import("@/components/charts/DspStreamChart"), { ssr: false })

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

interface AnalyticsData {
  streamsByDspDay: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  streamsByDay: Array<{ date: string; streams: number }>
  paidVsFree: Array<{ name: string; value: number }>
  streamsBySource: Array<{ name: string; value: number }>
  streamsByTrack?: Array<{ trackName: string; trackArtist: string; isrc: string; value: number; paid: number; free: number }>
  totalStreams?: number
}

/** Календарная дата в Europe/Moscow (совпадает с ключами данных rossel_flash). */
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

  // A7: МСК-даты (не UTC), чтобы диапазон не сдвигался на день
  return {
    startDate: mskDateString(start),
    endDate: mskDateString(end),
  }
}

/** A8: подпись дня в UTC — дата точки календарная, локальный getDate() сдвигал ось */
const formatDate = formatDayMonthUtc

export default function ArtistAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const username = typeof params?.username === "string" ? params.username : ""
  const profile = useDashboardProfile()
  const [loading, setLoading] = useState(true)
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

  /**
   * DS15: раньше админа отсюда выкидывало на свой дашборд — единственный
   * артистский экран, закрытый для админа (релизы, отчёты, выплаты, плейлисты
   * он смотреть может). Теперь админ видит аналитику артиста из URL.
   */
  const isAdminViewer = profile?.role === "admin"
  const [viewedArtistId, setViewedArtistId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    if (profile.role === "artist") {
      setViewedArtistId(profile.id)
      return
    }
    if (profile.role !== "admin") {
      router.push("/dashboard/login")
      return
    }
    // Админ смотрит чужой кабинет — id артиста берём по username из URL
    let cancelled = false
    fetch(`/api/artists?q=${encodeURIComponent(username)}&pageSize=50`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const match = (d.artists || []).find(
          (a: { username?: string }) => a.username?.toLowerCase() === username.toLowerCase()
        )
        setViewedArtistId(match?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setViewedArtistId(null)
      })
    return () => {
      cancelled = true
    }
  }, [profile, router, username])

  const currentUser = viewedArtistId ? { id: viewedArtistId } : null

  // Загрузка треков
  useEffect(() => {
    if (!currentUser?.id) return
    // F-PARS-8: отменяем предыдущий запрос, чтобы его ответ не перезаписал новый
    const controller = new AbortController()
    fetch(`/api/analytics/tracks?artistId=${currentUser.id}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { if (d.success) setTracks(d.tracks) })
      .catch(err => {
        if (err?.name !== "AbortError") console.error(err)
      })
    return () => controller.abort()
  }, [currentUser?.id])

  // Загрузка данных
  const loadData = useCallback(async (signal?: AbortSignal) => {
    if (!currentUser?.id) return
    setLoading(true)

    try {
      let startDate: string
      let endDate: string

      if (period === "custom" && customStart && customEnd) {
        // A7: выбранная дата — локальная полночь; mskDateString не даёт сдвига на день
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

      const params = new URLSearchParams({
        artistId: currentUser.id,
        startDate,
        endDate,
      })

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
  }, [currentUser?.id, period, selectedTrack, customStart, customEnd, tracks])

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

    if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const totalStreams = data?.streamsByDay.reduce((s, d) => s + d.streams, 0) || 0
  const totalPaid = data?.paidVsFree.find(p => p.name === "Платные")?.value || 0
  const totalFree = data?.paidVsFree.find(p => p.name === "Бесплатные")?.value || 0

  return (
    <div className="max-w-full p-0 pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Аналитика</span>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">АНАЛИТИКА</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Стримы по площадкам, трекам и выбранному периоду.
            </p>
          </div>

        <div className="flex w-full min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 md:contents">
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
                  {t.trackName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="min-w-0 md:hidden">
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
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`min-w-[max-content] rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  period === p.value
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-gray-500 hover:text-emerald-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

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
        </div>
      </div>

      <div className="space-y-6">
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
            <span className="flex shrink-0 items-center text-emerald-400">
              <span className="material-symbols-outlined text-[14px] leading-none">trending_up</span>
            </span>
          </div>
        </div>

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
            <p className="text-gray-400 mt-2 text-sm">Данные аналитики появятся после импорта из rossel_flash</p>
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
                {(data.streamsByTrack ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                ) : (
                  (data.streamsByTrack ?? []).map((item, idx) => {
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
              <p className="text-[10px] uppercase font-card-heading text-gray-500 tracking-widest mt-0.5">Всего: {(data.streamsByTrack ?? []).length} треков</p>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col mt-3">
              <div className="flex flex-col gap-0 overflow-y-auto pr-1 h-[290px]">
                {((data.streamsByTrack ?? []).length === 0) ? (
                  <p className="text-sm text-gray-500 py-4 font-card-heading text-center">Нет данных по трекам</p>
                ) : (
                  (data.streamsByTrack ?? []).map((item, idx) => {
                    const list = data.streamsByTrack ?? []
                    const maxVal = list[0]?.value || 1
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
      </div>
    </div>
  )
}
