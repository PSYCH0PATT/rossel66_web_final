"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AdminInput } from "@/components/ui/admin-input"
import { AdminSelect, AdminSelectContent, AdminSelectItem, AdminSelectTrigger, AdminSelectValue } from "@/components/ui/admin-select"
import { SelectContent, SelectItem } from "@/components/ui/select"
import Image from "next/image"
import Link from "next/link"
import type { AdminReleaseItem } from "@/lib/cached-dashboard"

type ReleaseRow = AdminReleaseItem & { artistName?: string }

function getStatusVariant(status?: string): "live" | "delivered" | "moderation" | "rejected" | "draft" {
  switch (status) {
    case "Доставлен":
    case "released":
    case "Одобрен":
      return "live"
    case "В доставке":
    case "delivery":
      return "delivered"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "moderation"
    case "Отклонен":
    case "Отклонён":
    case "Снят":
      return "rejected"
    default:
      return "draft"
  }
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case "Доставлен":
    case "released":
    case "Одобрен":
      return "Доставлен"
    case "В доставке":
    case "delivery":
      return "В доставке"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "Модерируется"
    case "Отклонен":
    case "Отклонён":
    case "Снят":
      return "Отклонен"
    default:
      return status || "Драфт"
  }
}

function StatusBadge({ status }: { status?: string }) {
  const variant = getStatusVariant(status)
  const label = getStatusLabel(status)

  if (variant === "live") {
    return (
      <span className="release-status-badge release-status-badge--live">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        {label}
      </span>
    )
  }
  if (variant === "delivered") {
    return (
      <span className="release-status-badge release-status-badge--delivered">
        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>check</span>
        {label}
      </span>
    )
  }
  if (variant === "moderation") {
    return (
      <span className="release-status-badge release-status-badge--moderation">
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: 10 }}>sync</span>
        {label}
      </span>
    )
  }
  if (variant === "rejected") {
    return (
      <span className="release-status-badge release-status-badge--rejected">
        <span className="material-symbols-outlined" style={{ fontSize: 10 }}>block</span>
        {label}
      </span>
    )
  }
  return (
    <span className="release-status-badge release-status-badge--draft">
      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>edit</span>
      {label}
    </span>
  )
}

/** Единая высота панели: кнопки и поле поиска h-10 */
const toolbarBtnClass =
  "h-10 min-h-10 inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors hover:border-white/25"

function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages: (number | "...")[] = []
  if (page <= 3) {
    pages.push(1, 2, 3, "...", totalPages)
  } else if (page >= totalPages - 2) {
    pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages)
  } else {
    pages.push(1, "...", page - 1, page, page + 1, "...", totalPages)
  }
  return pages
}

export default function AdminReleasesClient() {
  const [releases, setReleases] = useState<ReleaseRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterArtistName, setFilterArtistName] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val.trim())
      setPage(1)
    }, 350)
  }

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (debouncedQ) params.set("q", debouncedQ)
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (filterArtistName.trim()) params.set("artistName", filterArtistName.trim())
      if (filterDateFrom) params.set("dateFrom", filterDateFrom)
      if (filterDateTo) params.set("dateTo", filterDateTo)

      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()
      if (data.success && Array.isArray(data.releases)) {
        setReleases(data.releases as ReleaseRow[])
        setTotal(typeof data.total === "number" ? data.total : data.releases.length)
      } else {
        setReleases([])
        setTotal(0)
      }
    } catch {
      setReleases([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedQ, filterStatus, filterArtistName, filterDateFrom, filterDateTo])

  useEffect(() => {
    fetchReleases()
  }, [fetchReleases])

  const activeFiltersCount = useMemo(() => {
    let c = 0
    if (filterStatus !== "all") c++
    if (filterArtistName.trim()) c++
    if (filterDateFrom) c++
    if (filterDateTo) c++
    return c
  }, [filterStatus, filterArtistName, filterDateFrom, filterDateTo])

  const resetFilters = () => {
    setFilterStatus("all")
    setFilterArtistName("")
    setFilterDateFrom("")
    setFilterDateTo("")
    setQ("")
    setDebouncedQ("")
    setPage(1)
  }

  const handleAssignReleasesToArtists = async () => {
    if (!confirm("Привязать релизы без артиста ко всем артистам по имени?")) return
    setIsAssigning(true)
    try {
      const response = await fetch("/api/admin/assign-releases-to-artists", { method: "POST" })
      const result = await response.json()
      if (result.success) {
        alert(
          `✅ ${result.message}\n\nДетали:\n${result.details
            .map((d: any) => `• ${d.artist}: ${d.assigned} релиз(ов)`)
            .join("\n")}`
        )
        setPage(1)
        await fetchReleases()
      } else {
        alert(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      alert(`❌ Ошибка при привязке релизов: ${error}`)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleDeleteRelease = async (releaseId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот релиз?")) return
    try {
      const response = await fetch(`/api/releases/${releaseId}`, { method: "DELETE" })
      if (response.ok) {
        await fetchReleases()
      } else {
        alert("Ошибка при удалении релиза")
      }
    } catch {
      alert("Ошибка при удалении релиза")
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pageNumbers = getPageNumbers(page, totalPages)

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return "--"
      return d.toLocaleDateString("ru-RU")
    } catch {
      return "--"
    }
  }

  return (
    <div className="p-0 md:p-0 max-w-full pb-24">
      {/* Header section */}
      <div className="flex flex-col gap-6 mb-8">
        {/* Breadcrumb */}
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <span className="hover:text-[#10b981] cursor-pointer transition-colors">Dashboard</span>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>chevron_right</span>
          <span className="text-white">Релизы</span>
        </div>

        {/* Строка 1: только заголовок. Строка 2: все кнопки */}
        <div className="border-b border-white/5 pb-6">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            РЕЛИЗЫ
          </h1>

          <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            {/* Кнопки слева; на узком экране переносятся, на sm+ — скролл одной полосой */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 [-ms-overflow-style:none] [scrollbar-width:thin] sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
              <Link href="/dashboard/admin/releases/zvonko-parser" className="shrink-0">
                <button
                  type="button"
                  className={toolbarBtnClass}
                  style={{ borderColor: "rgba(59,130,246,0.35)", color: "#60a5fa", background: "rgba(59,130,246,0.08)" }}
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>download</span>
                  Zvonko Parser
                </button>
              </Link>

              <Link href="/dashboard/admin/releases/koala-parser" className="shrink-0">
                <button
                  type="button"
                  className={toolbarBtnClass}
                  style={{ borderColor: "rgba(16,185,129,0.35)", color: "#34d399", background: "rgba(16,185,129,0.08)" }}
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>sync</span>
                  Koala Parser
                </button>
              </Link>

              <button
                type="button"
                onClick={handleAssignReleasesToArtists}
                disabled={isAssigning}
                className={`${toolbarBtnClass} disabled:cursor-not-allowed disabled:opacity-50`}
                style={{ borderColor: "rgba(251,146,60,0.35)", color: "#fb923c", background: "rgba(251,146,60,0.08)" }}
              >
                <span className={`material-symbols-outlined shrink-0 ${isAssigning ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>
                  {isAssigning ? "sync" : "link"}
                </span>
                {isAssigning ? "Привязка..." : "Привязать релизы"}
              </button>

              {/* Filters */}
              <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className={`${toolbarBtnClass} relative`}
                    style={{
                      borderColor: activeFiltersCount > 0 ? "rgba(16,185,129,0.45)" : "rgba(255,255,255,0.12)",
                      color: activeFiltersCount > 0 ? "#10b981" : "#9ca3af",
                      background: activeFiltersCount > 0 ? "rgba(16,185,129,0.08)" : "rgba(0,0,0,0.35)",
                    }}
                  >
                    <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>tune</span>
                    Фильтры
                    {activeFiltersCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#10b981] text-[10px] font-bold text-black">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </DialogTrigger>
                <DialogContent
                  className="border-white/10 text-white"
                  style={{ backgroundColor: "#0f1117", maxWidth: "32rem", width: "100%" }}
                >
                  <DialogHeader>
                    <DialogTitle className="text-white font-display text-xl tracking-wide uppercase">
                      Фильтры релизов
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                        Статус
                      </Label>
                      <AdminSelect value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
                        <AdminSelectTrigger id="status" className="border-white/10 text-white bg-black/40">
                          <AdminSelectValue placeholder="Все статусы" />
                        </AdminSelectTrigger>
                        <SelectContent className="border-white/10 text-white" style={{ backgroundColor: "#0f1117" }}>
                          <SelectItem value="all">Все статусы</SelectItem>
                          <SelectItem value="Модерируется">Модерируется</SelectItem>
                          <SelectItem value="Отклонен">Отклонен</SelectItem>
                          <SelectItem value="В доставке">В доставке</SelectItem>
                          <SelectItem value="Доставлен">Доставлен</SelectItem>
                        </SelectContent>
                      </AdminSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="artist" className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                        Артист
                      </Label>
                      <AdminInput
                        id="artist"
                        type="text"
                        placeholder="Имя артиста (частичное совпадение)"
                        value={filterArtistName}
                        onChange={(e) => { setFilterArtistName(e.target.value); setPage(1) }}
                        className="border-white/10 text-white bg-black/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="dateFrom" className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                          Дата от
                        </Label>
                        <AdminInput
                          id="dateFrom"
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1) }}
                          className="border-white/10 text-white bg-black/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateTo" className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                          Дата до
                        </Label>
                        <AdminInput
                          id="dateTo"
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => { setFilterDateTo(e.target.value); setPage(1) }}
                          className="border-white/10 text-white bg-black/40"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <button
                        onClick={resetFilters}
                        className="flex-1 py-2 rounded-lg border border-white/10 text-gray-400 text-sm font-mono uppercase tracking-wider hover:border-white/20 hover:text-white transition-all"
                      >
                        Сбросить
                      </button>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 py-2 rounded-lg bg-[#10b981] text-black text-sm font-bold uppercase tracking-wider hover:bg-emerald-400 transition-all"
                      >
                        Применить
                      </button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {(activeFiltersCount > 0 || q) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className={toolbarBtnClass}
                  style={{ borderColor: "rgba(148,163,184,0.35)", color: "#94a3b8", background: "rgba(0,0,0,0.35)" }}
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>filter_alt_off</span>
                  Сбросить
                </button>
              )}

              <Link href="/dashboard/admin/releases/add" className="shrink-0">
                <button
                  type="button"
                  className={toolbarBtnClass}
                  style={{ borderColor: "rgba(16,185,129,0.45)", color: "#4ade80", background: "rgba(16,185,129,0.08)" }}
                >
                  <span className="material-symbols-outlined shrink-0" style={{ fontSize: 16 }}>add</span>
                  Добавить релиз
                </button>
              </Link>
            </div>

            {/* Поиск — справа, та же высота h-10 */}
            <div className="relative group h-10 w-full shrink-0 sm:ml-auto sm:w-72 sm:max-w-sm">
              <input
                type="text"
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Поиск по названию или UPC..."
                className="h-10 w-full rounded-lg border border-white/10 bg-black/40 py-0 pl-10 pr-9 font-mono text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/30 group-hover:border-white/15"
              />
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-hover:text-gray-400"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
              </span>
              {q && (
                <button
                  type="button"
                  onClick={() => handleSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                  aria-label="Очистить поиск"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Счётчик под разделителем, над таблицей, слева */}
      <div className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-3">
        {loading ? "Загрузка…" : total === 0 ? "0 релизов" : `${from}–${to} из ${total}`}
      </div>

      {/* Table */}
      <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#10b981]/50 to-transparent" />

        <div className="overflow-x-auto">
          {loading && releases.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <span className="material-symbols-outlined animate-spin text-[#10b981] text-4xl">sync</span>
            </div>
          ) : releases.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-600 block mb-4">library_music</span>
              <p className="text-gray-500 font-mono text-sm uppercase tracking-wider mb-4">Релизы не найдены</p>
              {(activeFiltersCount > 0 || debouncedQ) && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs font-mono uppercase tracking-wider hover:border-white/20 hover:text-white transition-all"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-gray-500 border-b border-white/10 bg-black/40">
                  <th className="px-6 py-5 font-mono">Обложка</th>
                  <th className="px-6 py-5 font-mono">Название</th>
                  <th className="px-6 py-5 font-mono">Артист</th>
                  <th className="px-6 py-5 font-mono">UPC</th>
                  <th className="px-6 py-5 font-mono">Дата</th>
                  <th className="px-6 py-5 font-mono">Статус</th>
                  <th className="px-6 py-5 font-mono text-center">Треков</th>
                  <th className="px-6 py-5 font-mono text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {releases.map((release) => (
                  <tr
                    key={release.id}
                    className="group border-b border-white/5 transition-all duration-200 table-row-hover relative"
                  >
                    {/* Cover */}
                    <td className="px-6 py-4">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden group-hover:ring-1 group-hover:ring-[#10b981]/50 transition-all flex-shrink-0">
                        {release.coverUrl ? (
                          <Image
                            src={release.coverUrl}
                            alt={release.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800/60 flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-600" style={{ fontSize: 22 }}>album</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 hidden group-hover:flex items-center justify-center backdrop-blur-[1px]">
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>play_arrow</span>
                        </div>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/admin/releases/${release.id}`}>
                        <div className="font-bold text-white group-hover:text-[#10b981] transition-colors leading-snug max-w-[200px] truncate">
                          {release.title}
                        </div>
                        {(release as any).type && (
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">{(release as any).type}</div>
                        )}
                      </Link>
                    </td>

                    {/* Artist */}
                    <td className="px-6 py-4">
                      <div className="text-gray-300 max-w-[160px] truncate">{release.artistName ?? ""}</div>
                    </td>

                    {/* UPC */}
                    <td className="px-6 py-4 font-mono text-xs text-gray-400 tracking-wider">
                      {release.upc || "--"}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                      {release.releaseDate ? formatDate(release.releaseDate) : "--"}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={release.status} />
                    </td>

                    {/* Tracks */}
                    <td className="px-6 py-4 text-center text-gray-400 font-mono">
                      <span className="flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-emerald-500/60" style={{ fontSize: 14 }}>music_note</span>
                        {Array.isArray(release.tracks) ? release.tracks.length : 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/admin/releases/${release.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#10b981]/30 text-[#10b981] hover:bg-[#10b981]/15 hover:border-[#10b981]/60 transition-all"
                          title="Редактировать"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                        </Link>
                        <button
                          onClick={() => handleDeleteRelease(release.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/15 hover:border-red-500/60 transition-all"
                          title="Удалить"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Loading overlay when paginating */}
          {loading && releases.length > 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-xl backdrop-blur-[1px]">
              <span className="material-symbols-outlined animate-spin text-[#10b981] text-4xl">sync</span>
            </div>
          )}
        </div>

        {/* Pagination footer */}
        <div className="px-6 py-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-3 bg-black/20">
          <div className="text-xs text-gray-500 font-mono uppercase">
            {loading
              ? "Загрузка..."
              : `Показано ${from}–${to} из ${total} релизов`}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Page size selector */}
            <div className="flex items-center gap-1 mr-2">
              {([20, 50, 100] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1) }}
                  className={`px-2 py-1 rounded text-xs border transition-colors font-mono ${
                    pageSize === size
                      ? "bg-[#10b981]/20 border-[#10b981]/30 text-[#10b981]"
                      : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Previous */}
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
            >
              Previous
            </button>

            {pageNumbers.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="text-gray-600 text-xs font-mono px-1">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`px-3 py-1 rounded text-xs border transition-colors font-mono ${
                    p === page
                      ? "bg-[#10b981]/20 border-[#10b981]/30 text-[#10b981]"
                      : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            {/* Next */}
            <button
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Footer status */}
      <div className="mt-12 flex justify-between items-center pt-6 border-t border-white/5 text-sm">
        <div className="text-gray-500 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block animate-pulse" />
          System Online
        </div>
        <div className="text-gray-400 font-mono">
          TOTAL RELEASES: <span className="text-white font-bold">{loading ? "…" : total}</span>
        </div>
      </div>
    </div>
  )
}
