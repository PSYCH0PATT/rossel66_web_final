"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
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

const filterInput =
  "h-10 rounded-lg border border-white/10 bg-white/5 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

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

  useEffect(() => {
    loadHistory()
  }, [filters])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.append("startDate", filters.startDate)
      if (filters.endDate) params.append("endDate", filters.endDate)
      if (filters.changeType !== "all") params.append("changeType", filters.changeType)
      if (filters.artistName) params.append("artistName", filters.artistName)
      if (filters.playlistUrl) params.append("playlistUrl", filters.playlistUrl)
      params.append("limit", "100")

      const response = await fetch(`/api/playlists/history?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setHistory(data.results || [])
      }
    } catch (error) {
      console.error("Ошибка загрузки истории:", error)
    } finally {
      setLoading(false)
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

  const getChangeTypeClass = (type: string) => {
    const map: Record<string, string> = {
      added: "bg-primary/15 text-primary border-primary/30",
      updated: "bg-accent-azure/15 text-accent-azure border-accent-azure/30",
      removed: "bg-red-500/15 text-red-400 border-red-500/30",
      position_changed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    }
    return map[type] || "bg-white/5 text-gray-400 border-white/10"
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

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <Link href="/dashboard/admin/playlists" className="hover:text-primary transition-colors">
              Плейлисты
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">История</span>
          </div>
          <div className="border-b border-white/5 pb-8 flex flex-col sm:flex-row items-start sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">
                История плейлистов
              </h1>
              <p className="text-sm text-gray-400 font-light mt-2">Изменения из SFTP и синхронизаций</p>
            </div>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            <span className="material-symbols-outlined text-primary">filter_alt</span>
            Фильтры
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 mb-1.5 block">Дата от</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className={filterInput}
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 mb-1.5 block">Дата до</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className={filterInput}
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 mb-1.5 block">Тип</label>
              <Select value={filters.changeType} onValueChange={(value) => setFilters({ ...filters, changeType: value })}>
                <SelectTrigger className={filterInput}>
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
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 mb-1.5 block">Артист</label>
              <Input
                placeholder="Имя..."
                value={filters.artistName}
                onChange={(e) => setFilters({ ...filters, artistName: e.target.value })}
                className={filterInput}
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-gray-500 mb-1.5 block">URL</label>
              <Input
                placeholder="URL плейлиста..."
                value={filters.playlistUrl}
                onChange={(e) => setFilters({ ...filters, playlistUrl: e.target.value })}
                className={filterInput}
                spellCheck={false}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              type="button"
              onClick={loadHistory}
              disabled={loading}
              className="rounded-lg bg-primary text-black hover:bg-primary/90 font-semibold"
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

        <div className="card-glass rounded-2xl border border-white/5 p-6">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-accent-azure rounded-full" />
            <span className="material-symbols-outlined text-accent-azure">history</span>
            Записи ({history.length})
          </h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-mono text-sm">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-mono text-sm border border-dashed border-white/10 rounded-xl">
              Нет записей
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-x-auto table-glass">
              <table className="w-full border-collapse min-w-[700px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-mono uppercase text-gray-500 border-b border-white/10">
                    <th className="p-3 whitespace-nowrap">Дата</th>
                    <th className="p-3 whitespace-nowrap">Тип</th>
                    <th className="p-3">Плейлист</th>
                    <th className="p-3 whitespace-nowrap">Платформа</th>
                    <th className="p-3 whitespace-nowrap">Артист</th>
                    <th className="p-3">Трек</th>
                    <th className="p-3 whitespace-nowrap">Позиция</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id} className="border-b border-white/5 hover:bg-white/[0.04] table-row-hover">
                      <td className="p-3 text-gray-300 whitespace-nowrap [font-variant-numeric:tabular-nums] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-gray-500">schedule</span>
                          <span>{formatChangeDate(record.change_date)}</span>
                          {formatChangeTime(record.created_at) && (
                            <span className="text-gray-500">{formatChangeTime(record.created_at)}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`release-status-badge text-[0.65rem] border ${getChangeTypeClass(record.change_type)}`}>
                          {getChangeTypeLabel(record.change_type)}
                        </span>
                      </td>
                      <td className="p-3 min-w-0 max-w-xs">
                        <div className="truncate text-white" title={record.playlist_name}>
                          {record.playlist_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={record.playlist_url}>
                          {record.playlist_url}
                        </div>
                      </td>
                      <td className="p-3 text-gray-400">{record.platform}</td>
                      <td className="p-3 text-gray-300">{record.artist_name || "—"}</td>
                      <td className="p-3 min-w-0 max-w-[140px]">
                        {record.track_title ? (
                          <div className="truncate text-gray-400" title={record.track_title}>
                            {record.track_title}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3 text-gray-300 [font-variant-numeric:tabular-nums]">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>
    )
}
