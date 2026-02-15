"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BarChart3, TrendingUp, CalendarIcon, Loader2, Upload, RefreshCw, Download } from "lucide-react"

const DspStreamChart = dynamic(() => import("@/components/charts/DspStreamChart"), { ssr: false })
const TotalStreamChart = dynamic(() => import("@/components/charts/TotalStreamChart"), { ssr: false })

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
  trackArtist: string
  artistId: string
}

interface AnalyticsData {
  streamsByDspDay: Array<{ date: string; [dsp: string]: string | number }>
  dsps: string[]
  streamsByDay: Array<{ date: string; streams: number }>
  paidVsFree: Array<{ name: string; value: number }>
  streamsBySource: Array<{ name: string; value: number }>
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
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  }
}

function formatDate(dateStr: any) {
  const d = new Date(String(dateStr))
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

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

  // Auth
  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.role === "admin") {
          setCurrentUser(user)
        } else {
          router.push("/dashboard/artist/dashboard")
        }
      } catch {
        router.push("/dashboard/login")
      }
    } else {
      router.push("/dashboard/login")
    }
  }, [router])

  // Загрузка артистов
  useEffect(() => {
    fetch("/api/analytics/artists")
      .then(r => r.json())
      .then(d => { if (d.success) setArtists(d.artists) })
      .catch(console.error)
  }, [])

  // Загрузка треков при смене артиста
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedArtist !== "all") params.set("artistId", selectedArtist)

    fetch(`/api/analytics/tracks?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTracks(d.tracks)
        setSelectedTrack("all") // сброс при смене артиста
      })
      .catch(console.error)
  }, [selectedArtist])

  // Загрузка данных
  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      let startDate: string
      let endDate: string

      if (period === "custom" && customStart && customEnd) {
        startDate = customStart.toISOString().split("T")[0]
        endDate = customEnd.toISOString().split("T")[0]
      } else if (period !== "custom") {
        const range = getDateRange(period)
        startDate = range.startDate
        endDate = range.endDate
      } else {
        setLoading(false)
        return
      }

      const params = new URLSearchParams({ startDate, endDate })

      if (selectedArtist !== "all") params.set("artistId", selectedArtist)
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
  }, [period, selectedArtist, selectedTrack, customStart, customEnd, tracks])

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
        loadData() // перезагружаем данные
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

  // Синхронизация из SFTP
  const handleSync = async (mode: '7days' | 'latest' | 'all') => {
    setSyncing(true)
    setImportResult(null)

    try {
      const res = await fetch("/api/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      })
      const json = await res.json()

      if (json.success) {
        const stats = json.stats || {}
        const modeMsg = mode === 'all'
          ? `Полный импорт: обработано ${stats.filesProcessed || 0} файлов, добавлено ${stats.totalAdded || 0} записей, пропущено ${stats.totalSkipped || 0} дубликатов`
          : mode === '7days'
            ? `Синхронизация (7 дней): обработано ${stats.filesProcessed || 0} файлов, добавлено ${stats.totalAdded || 0} записей, пропущено ${stats.totalSkipped || 0} дубликатов`
            : `Синхронизация: добавлено ${stats.totalAdded || 0} записей, пропущено ${stats.totalSkipped || 0} дубликатов`
        setImportResult(modeMsg)
        loadData()
        // Обновляем треки и артистов
        fetch("/api/analytics/artists").then(r => r.json()).then(d => { if (d.success) setArtists(d.artists) })
        const params = new URLSearchParams()
        if (selectedArtist !== "all") params.set("artistId", selectedArtist)
        fetch(`/api/analytics/tracks?${params}`).then(r => r.json()).then(d => { if (d.success) setTracks(d.tracks) })
      } else {
        setImportResult(`Ошибка: ${json.error || json.details || 'Unknown'}`)
      }
    } catch (err) {
      setImportResult(`Ошибка: ${err}`)
    } finally {
      setSyncing(false)
    }
  }

  if (!currentUser) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    )
  }

  const totalStreams = data?.streamsByDay.reduce((s, d) => s + d.streams, 0) || 0
  const totalPaid = data?.paidVsFree.find(p => p.name === "Платные")?.value || 0
  const totalFree = data?.paidVsFree.find(p => p.name === "Бесплатные")?.value || 0

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Аналитика стримов</h1>
            <p className="text-gray-400 mt-1">Статистика прослушиваний всех артистов</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync latest from SFTP */}
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:text-white"
              onClick={() => handleSync('7days')}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Синхронизировать
            </Button>

            {/* Import ALL from SFTP */}
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:text-white"
              onClick={() => handleSync('all')}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Импорт всех файлов
            </Button>

            {/* Manual CSV upload */}
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:text-white" asChild disabled={importing}>
                <span>
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Загрузить CSV
                </span>
              </Button>
            </label>
          </div>
        </div>

        {importResult && (
          <div className={`p-3 rounded-lg text-sm ${importResult.startsWith("Ошибка") ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
            {importResult}
          </div>
        )}

        {/* Filters */}
        <Card className="bg-card border-gray-700">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Artist selector */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <label className="text-xs text-gray-400 font-medium">Артист</label>
                <Select value={selectedArtist} onValueChange={setSelectedArtist}>
                  <SelectTrigger className="bg-background border-gray-600 text-white">
                    <SelectValue placeholder="Все артисты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все артисты</SelectItem>
                    {artists.map(a => (
                      <SelectItem key={a.artistId} value={a.artistId}>
                        {a.trackArtist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Track selector */}
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-xs text-gray-400 font-medium">Трек</label>
                <Select value={selectedTrack} onValueChange={setSelectedTrack}>
                  <SelectTrigger className="bg-background border-gray-600 text-white">
                    <SelectValue placeholder="Все треки" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все треки</SelectItem>
                    {tracks.map(t => (
                      <SelectItem key={t.isrc} value={t.isrc}>
                        {t.trackName} — {t.trackArtist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period selector */}
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs text-gray-400 font-medium">Период (XY графики)</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="bg-background border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom date range */}
              {period === "custom" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 font-medium">От</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="bg-background border-gray-600 text-white justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customStart ? customStart.toLocaleDateString("ru-RU") : "Выберите дату"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customStart} onSelect={setCustomStart} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400 font-medium">До</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="bg-background border-gray-600 text-white justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customEnd ? customEnd.toLocaleDateString("ru-RU") : "Выберите дату"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              {/* Summary chips */}
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-medium">
                  <TrendingUp className="h-4 w-4" />
                  {totalStreams.toLocaleString("ru-RU")} стримов
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : !data || (data.streamsByDay.length === 0 && data.paidVsFree.every(p => p.value === 0)) ? (
          <Card className="bg-card border-gray-700">
            <CardContent className="py-16 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-medium text-white">Нет данных</h3>
              <p className="text-gray-400 mt-2">Импортируйте CSV файл из rossel_flash или дождитесь автоматического импорта в 20:00 МСК</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: XY Charts */}

            {/* Chart 1: Streams by DSP */}
            <Card className="bg-card border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Стримы по площадкам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[380px] sm:h-[340px] lg:h-[300px]">
                  {chartMounted ? (
                    <DspStreamChart data={data.streamsByDspDay} dsps={data.dsps} formatDate={formatDate} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Загрузка графика…</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Paid vs Free */}
            <Card className="bg-card border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Платные / Бесплатные стримы</CardTitle>
                <p className="text-xs text-gray-500">За всё время</p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex flex-col justify-center">
                  <div className="space-y-4">
                    {data.paidVsFree.map((item) => {
                      const total = totalPaid + totalFree
                      const pct = total > 0 ? (item.value / total) * 100 : 0
                      const isPaid = item.name === "Платные"
                      return (
                        <div key={item.name} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-300 font-medium">{item.name}</span>
                            <span className="text-white font-semibold">
                              {item.value.toLocaleString("ru-RU")} ({pct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-8 bg-gray-700 rounded-lg overflow-hidden">
                            <div
                              className="h-full rounded-lg transition-all duration-500"
                              style={{
                                width: `${Math.max(pct, 1)}%`,
                                backgroundColor: isPaid ? BAR_COLORS.paid : BAR_COLORS.free,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LEFT: Total streams by day */}
            <Card className="bg-card border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Общие прослушивания по дням</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {chartMounted ? (
                    <TotalStreamChart data={data.streamsByDay} formatDate={formatDate} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Загрузка графика…</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Streams by source */}
            <Card className="bg-card border-gray-700 flex flex-col">
              <CardHeader className="pb-1 pt-3 flex-shrink-0">
                <CardTitle className="text-white text-base">Стримы по источникам</CardTitle>
                <p className="text-xs text-gray-500">За всё время</p>
              </CardHeader>
              <CardContent className="pt-2 pb-3 flex-1 min-h-0 flex flex-col">
                <div className="flex flex-col flex-1 min-h-[300px] gap-0">
                  {data.streamsBySource.map((item, idx) => {
                    const maxVal = data.streamsBySource[0]?.value || 1
                    const pct = (item.value / maxVal) * 100
                    return (
                      <div key={item.name} className="flex items-center gap-2 flex-1 min-h-0 py-0.5">
                        <span className="text-xs text-gray-300 truncate shrink-0 w-[120px]">{item.name}</span>
                        <div className="flex-1 min-w-0 h-full min-h-[14px] bg-gray-700 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-xs text-white font-semibold shrink-0 w-14 text-right">{item.value.toLocaleString("ru-RU")}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  )
}
