"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import Link from "next/link"
import type { AdminArtistItem } from "@/lib/cached-dashboard"
import { DashboardFooter } from "@/components/dashboard-footer"
import {
  ARTIST_REPORT_FIELD_LABELS,
  getArtistReportMissingFields,
} from "@/lib/artist-report-requirements"

export default function AdminArtistsClient() {
  const [allArtists, setAllArtists] = useState<AdminArtistItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all")
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [stats, setStats] = useState({ all: 0, verified: 0, unverified: 0 })
  const [loading, setLoading] = useState(true)
  const [gridCols, setGridCols] = useState<number>(2)
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({})
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, filter])

  const getAdaptiveSize = (baseSize: number) => {
    if (gridCols <= 2) return Math.round(baseSize * 0.5)
    if (gridCols <= 3) return Math.round(baseSize * 0.6)
    if (gridCols <= 4) return Math.round(baseSize * 0.7)
    if (gridCols <= 5) return Math.round(baseSize * 0.85)
    if (gridCols <= 6) return baseSize
    if (gridCols <= 7) return Math.round(baseSize * 1.1)
    return Math.round(baseSize * 1.2)
  }

  useEffect(() => {
    const computeCols = () => {
      if (typeof window === "undefined") return 2
      const w = window.innerWidth
      if (w >= 2560) return 8
      if (w >= 1920) return 7
      if (w >= 1600) return 6
      if (w >= 1280) return 5
      if (w >= 1080) return 5
      if (w >= 768) return 4
      if (w >= 640) return 3
      return 2
    }
    const updateCols = () => setGridCols(computeCols())
    updateCols()
    window.addEventListener("resize", updateCols)
    return () => window.removeEventListener("resize", updateCols)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("pageSize", String(pageSize))
      if (debouncedQ) params.set("q", debouncedQ)
      if (filter === "verified") params.set("verified", "true")
      if (filter === "unverified") params.set("verified", "false")
      const res = await fetch(`/api/artists?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setAllArtists(data.artists ?? [])
        setTotal(typeof data.total === "number" ? data.total : 0)
        if (data.stats) {
          setStats({
            all: data.stats.all ?? 0,
            verified: data.stats.verified ?? 0,
            unverified: data.stats.unverified ?? 0,
          })
        }
      }
    } catch (e) {
      console.error(e)
      setBanner({ type: "error", text: "Не удалось загрузить список артистов" })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filter, debouncedQ])

  useEffect(() => {
    load()
  }, [load])

  const verifyArtist = async (artistId: string) => {
    setIsVerifying((prev) => ({ ...prev, [artistId]: true }))
    setBanner(null)
    try {
      const response = await fetch("/api/artists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: artistId, verified: true }),
      })
      const result = await response.json()
      if (result.success) {
        setAllArtists((prev) => prev.map((a) => (a.id === artistId ? { ...a, verified: true } : a)))
        await load()
        setBanner({ type: "success", text: "Артист подтверждён" })
      } else {
        setBanner({ type: "error", text: result.error || "Ошибка при подтверждении" })
      }
    } catch {
      setBanner({ type: "error", text: "Произошла ошибка при подтверждении артиста" })
    } finally {
      setIsVerifying((prev) => ({ ...prev, [artistId]: false }))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { id: artistId, name: artistName } = deleteTarget
    setDeleteTarget(null)
    setIsDeleting((prev) => ({ ...prev, [artistId]: true }))
    setBanner(null)
    try {
      const response = await fetch(`/api/artists?id=${artistId}`, { method: "DELETE" })
      const result = await response.json()
      if (result.success) {
        await load()
        setBanner({ type: "success", text: `Артист «${artistName}» удалён` })
      } else {
        setBanner({ type: "error", text: result.error || "Ошибка при удалении" })
      }
    } catch {
      setBanner({ type: "error", text: "Произошла ошибка при удалении артиста" })
    } finally {
      setIsDeleting((prev) => ({ ...prev, [artistId]: false }))
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const hasPrev = page > 1
  const hasNext = page * pageSize < total

  return (
    <>
      {banner && (
        <div
          role="status"
          className={`mb-6 rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
            banner.type === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          <span className="material-symbols-outlined flex-shrink-0">
            {banner.type === "error" ? "error" : "check_circle"}
          </span>
          {banner.text}
        </div>
      )}

      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link href="/dashboard/admin/dashboard" className="hover:text-primary cursor-pointer transition-colors">
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined text-[10px]">chevron_right</span>
          <span className="text-white">Артисты</span>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-8">
          <div className="min-w-0">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight uppercase">
              Артисты
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-xl">
              {debouncedQ
                ? `Найдено: ${total} (поиск «${debouncedQ}»)`
                : filter === "all"
                  ? `Всего в системе: ${stats.all}`
                  : filter === "verified"
                    ? `Подтверждённые: ${stats.verified} из ${stats.all}`
                    : `Неподтверждённые: ${stats.unverified} из ${stats.all}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admin/artists/bulk-add"
              className="text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest border border-white/10 rounded-lg px-3 py-2 inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="material-symbols-outlined text-lg">group_add</span>
              <span className="hidden sm:inline">Массовое добавление</span>
            </Link>
            <Link
              href="/dashboard/admin/artists/add"
              className="bg-[#10b981] hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg px-4 py-2.5 inline-flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span className="hidden sm:inline">Добавить артиста</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="stat-card-glass p-6 rounded-2xl border border-white/5">
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Всего</h3>
          <p className="text-4xl font-bold text-white font-display tabular-nums">{stats.all}</p>
        </div>
        <div className="stat-card-glass p-6 rounded-2xl border border-white/5">
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Подтверждены</h3>
          <p className="text-4xl font-bold text-white font-display tabular-nums text-primary">{stats.verified}</p>
        </div>
        <div className="stat-card-glass p-6 rounded-2xl border border-white/5">
          <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-2">Новые</h3>
          <p className="text-4xl font-bold text-white font-display tabular-nums text-yellow-400">{stats.unverified}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 items-stretch sm:items-end justify-between">
        <div className="relative group max-w-md w-full">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени или username…"
            className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-[#10b981] focus:border-[#10b981] block w-full p-2.5 pl-10 placeholder-gray-600 font-mono transition-all group-hover:border-white/20 outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-600 group-hover:text-gray-400 transition-colors text-[18px]">
            search
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
          <span className="hidden sm:inline">На стр.</span>
          {([20, 50, 100] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => {
                setPageSize(size)
                setPage(1)
              }}
              className={`px-2 py-1 rounded text-xs border transition-colors font-mono ${
                pageSize === size
                  ? "bg-[#10b981]/20 border-[#10b981]/30 text-[#10b981]"
                  : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {size}
            </button>
          ))}
          <span className="tabular-nums ml-2">
            {from}–{to} / {total}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {(
          [
            { id: "all" as const, label: `Все (${stats.all})` },
            { id: "verified" as const, label: `Подтверждённые (${stats.verified})` },
            { id: "unverified" as const, label: `Новые (${stats.unverified})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-2 rounded-lg text-xs font-mono border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              filter === tab.id
                ? "bg-primary/20 border-primary/30 text-primary"
                : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Loading…</span>
        </div>
      ) : (
        <>
          <div
            className="grid gap-2 sm:gap-3 mb-8"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {allArtists.map((artist) => (
              <div key={artist.id} className="relative group">
                {!(artist.verified ?? true) && (
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    Новый
                  </div>
                )}

                <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!(artist.verified ?? true) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        verifyArtist(artist.id)
                      }}
                      disabled={isVerifying[artist.id]}
                      className="rounded-full flex items-center justify-center bg-emerald-600/90 hover:bg-emerald-500 text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{
                        padding: `${getAdaptiveSize(8)}px`,
                        width: `${getAdaptiveSize(36)}px`,
                        height: `${getAdaptiveSize(36)}px`,
                      }}
                      aria-label="Подтвердить артиста"
                      title="Подтвердить артиста"
                    >
                      {isVerifying[artist.id] ? (
                        <div
                          className="animate-spin rounded-full border-2 border-white border-t-transparent"
                          style={{
                            width: `${getAdaptiveSize(16)}px`,
                            height: `${getAdaptiveSize(16)}px`,
                          }}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-white" style={{ fontSize: `${getAdaptiveSize(18)}px` }}>
                          check
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDeleteTarget({ id: artist.id, name: artist.name })
                    }}
                    disabled={isDeleting[artist.id]}
                    className="rounded-full flex items-center justify-center bg-red-600/90 hover:bg-red-500 text-white transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                    style={{
                      width: `${getAdaptiveSize(36)}px`,
                      height: `${getAdaptiveSize(36)}px`,
                    }}
                    aria-label="Удалить артиста"
                    title="Удалить артиста"
                  >
                    {isDeleting[artist.id] ? (
                      <div
                        className="animate-spin rounded-full border-2 border-white border-t-transparent"
                        style={{
                          width: `${getAdaptiveSize(16)}px`,
                          height: `${getAdaptiveSize(16)}px`,
                        }}
                      />
                    ) : (
                      <span className="material-symbols-outlined text-white" style={{ fontSize: `${getAdaptiveSize(18)}px` }}>
                        delete
                      </span>
                    )}
                  </button>
                </div>

                <Link href={`/dashboard/admin/artists/${artist.id}`} className="block">
                  <div
                    className="artist-card-container rounded-xl w-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden card-glass border border-white/5 hover:border-primary/40 hover:-translate-y-0.5"
                    style={{
                      padding: "max(8px, 0.6vw)",
                      aspectRatio: "1 / 1",
                      minHeight: "0",
                      height: "auto",
                    }}
                  >
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-full"
                      style={{ marginBottom: "max(4px, 0.4vw)" }}
                    >
                      {artist.avatarUrl ? (
                        <div className="rounded-full overflow-hidden flex-shrink-0 w-[45.5%] aspect-square border-2 border-primary/60 hover:border-primary transition-colors">
                          <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="relative flex flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/60 bg-white/5 aspect-square w-[45.5%]">
                          <span
                            className="material-symbols-outlined pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-none text-white text-[clamp(1.25rem,5vw,2.75rem)]"
                            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                          >
                            person
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto text-center w-full overflow-hidden" style={{ marginBottom: "max(4px, 0.5vw)" }}>
                      <h3
                        className="artist-card-name font-semibold truncate transition-colors w-full overflow-hidden text-ellipsis text-white"
                        style={{ marginBottom: "2px" }}
                        title={artist.name}
                      >
                        {artist.name}
                      </h3>
                      <p
                        className="artist-card-username truncate w-full overflow-hidden text-ellipsis text-gray-400 font-mono text-xs"
                        style={{ marginBottom: "2px" }}
                        title={`@${artist.username}`}
                      >
                        @{artist.username}
                      </p>
                      {artist.fioShort && (
                        <p
                          className="artist-card-meta truncate w-full overflow-hidden text-ellipsis text-gray-600 text-[10px]"
                          title={artist.fio ?? ""}
                        >
                          {artist.fioShort}
                        </p>
                      )}
                      {(() => {
                        const missing = getArtistReportMissingFields(artist)
                        if (missing.length === 0) {
                          return (
                            <p className="artist-card-meta truncate w-full text-primary text-[10px] font-mono tabular-nums">
                              {artist.percentage}%
                            </p>
                          )
                        }
                        return (
                          <span
                            className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-widest border border-amber-500/30 bg-amber-500/10 text-amber-300"
                            title={`Нет: ${missing.map((f) => ARTIST_REPORT_FIELD_LABELS[f]).join(", ")}`}
                          >
                            нет данных для отчёта
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {allArtists.length === 0 && (
            <div className="text-center py-12 text-gray-500 font-mono text-sm uppercase tracking-wider mb-8">
              Нет артистов по текущим фильтрам
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <button
              type="button"
              disabled={!hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
              Назад
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Далее
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </>
      )}

      <DashboardFooter />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Удалить артиста?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">
            Артист «{deleteTarget?.name}» будет удалён безвозвратно. Это действие нельзя отменить.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 text-sm font-mono uppercase tracking-wider"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold"
            >
              Удалить
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
