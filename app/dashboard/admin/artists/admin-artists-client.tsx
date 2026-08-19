"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
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
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({})
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, filter])



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
            className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-[#10b981] focus:border-[#10b981] block min-h-11 w-full p-2.5 pl-10 placeholder-gray-600 font-mono transition-all group-hover:border-white/20 outline-none"
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
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-2 py-1 font-mono text-xs transition-colors ${
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
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
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
            {allArtists.map((artist) => {
              // Одна величина на все четыре стороны: угловые значки должны
              // стоять ровно на той же линии, что и текст, на любой ширине.
              const pad = "max(8px, 0.55vw)"
              const missing = getArtistReportMissingFields(artist)
              const isNew = !(artist.verified ?? true)
              // У новых артистов данных нет по определению — значок появляется
              // только после подтверждения, иначе он висел бы у всех подряд.
              const showMissing = missing.length > 0 && !isNew
              const missingText = missing.map((f) => ARTIST_REPORT_FIELD_LABELS[f]).join(", ")

              return (
              <div key={artist.id} className="group relative">
                <Link
                  href={`/dashboard/admin/artists/${artist.id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div
                    className="artist-card-container relative w-full overflow-hidden rounded-lg border border-white/5 card-glass cursor-pointer transition-colors duration-200 hover:border-primary/40"
                    style={{ padding: pad }}
                  >
                    {/* Отступ справа — построчный и только под то, что реально
                        есть в углу: общий отступ съедал ширину имени у всех. */}
                    <div className="min-w-0">
                      <h3
                        className="artist-card-name truncate font-semibold text-white"
                        style={{ paddingRight: isNew ? 84 : 0 }}
                        title={artist.name}
                      >
                        {artist.name}
                      </h3>

                      <p
                        className="artist-card-username truncate font-mono text-gray-400"
                        title={`@${artist.username}`}
                      >
                        @{artist.username}
                      </p>

                      <div
                        className="artist-card-meta mt-0.5 flex min-w-0 items-center gap-1.5 text-gray-500"
                        style={{ paddingRight: showMissing ? 24 : 0 }}
                      >
                        <span
                          className={`shrink-0 font-mono tabular-nums ${
                            missing.includes("percentage") ? "text-amber-300" : "text-primary"
                          }`}
                        >
                          {artist.percentage ?? 0}%
                        </span>
                        {artist.fioShort && (
                          <>
                            <span aria-hidden className="text-gray-600">
                              ·
                            </span>
                            <span className="truncate" title={artist.fio ?? ""}>
                              {artist.fioShort}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Верхний правый угол: подтверждение (по наведению) и метка «Новый». */}
                {isNew && (
                  <div className="absolute z-10 flex items-center gap-1" style={{ top: pad, right: pad }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        verifyArtist(artist.id)
                      }}
                      disabled={isVerifying[artist.id]}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 opacity-0 transition-opacity duration-150 hover:border-emerald-300/80 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Подтвердить артиста ${artist.name}`}
                      title="Подтвердить артиста"
                    >
                      {isVerifying[artist.id] ? (
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                      ) : (
                        <span className="material-symbols-outlined leading-none" style={{ fontSize: 13 }}>
                          check
                        </span>
                      )}
                    </button>

                    {/* Текст центрируем flex-ом при leading-none: с прежними
                        px/py надпись сидела в контуре не по центру. */}
                    <span className="inline-flex h-5 shrink-0 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/15 px-2 font-mono text-[9px] uppercase leading-none tracking-wider text-sky-300">
                      Новый
                    </span>
                  </div>
                )}

                {/* Нижний правый угол: чего не хватает для отчёта. Подсказка на
                    hidden/block, а не на title — нативный тултип ждёт секунду. */}
                {showMissing && (
                  <div className="group/warn absolute z-20" style={{ bottom: pad, right: pad }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 font-mono text-[11px] font-bold leading-none text-amber-300">
                      !
                    </span>
                    <div className="pointer-events-none absolute bottom-full right-0 mb-1 hidden whitespace-nowrap rounded-md border border-amber-400/30 bg-[#1c1508] px-2 py-1 font-mono text-[10px] leading-none text-amber-200 shadow-lg group-hover/warn:block">
                      Нет: {missingText}
                    </div>
                    <span className="sr-only">Нет данных для отчёта: {missingText}</span>
                  </div>
                )}
              </div>
              )
            })}
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
              className="inline-flex min-h-11 items-center gap-1 rounded border border-white/5 bg-white/5 px-3 py-1 font-mono text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
              Назад
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded border border-white/5 bg-white/5 px-3 py-1 font-mono text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Далее
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </>
      )}

      <DashboardFooter />

    </>
  )
}
