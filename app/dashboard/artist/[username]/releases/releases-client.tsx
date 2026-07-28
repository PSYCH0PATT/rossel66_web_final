"use client"

import { useMemo, useRef, useState } from "react"
import { formatDateRu } from "@/lib/format-date"
import Image from "next/image"
import Link from "next/link"
import { useReleasesList } from "@/lib/hooks/use-dashboard-fetch"

interface Release {
  id: string
  artistId: string
  title: string
  type?: string
  coverUrl?: string
  upc?: string
  releaseDate: string
  status?: string
  tracks?: any[]
  trackCount?: number
  primaryIsrc?: string
  featuredArtistNames?: string[]
  artistDisplay: string
}

function buildArtistDisplay(release: any, mainName: string): string {
  const featuredNames: string[] = []
  if (Array.isArray(release.featuredArtistNames)) {
    for (const nm of release.featuredArtistNames) {
      if (nm) featuredNames.push(nm)
    }
  }
  if (Array.isArray(release.tracks)) {
    for (const t of release.tracks as any[]) {
      if (Array.isArray(t?.featuredArtistNames)) {
        for (const nm of t.featuredArtistNames) {
          if (nm && !featuredNames.includes(nm)) featuredNames.push(nm)
        }
      }
    }
  }
  return featuredNames.length ? `${mainName}, ${featuredNames.join(", ")}` : mainName
}

type StatusVariant = "live" | "delivered" | "moderation" | "draft" | "rejected"

function getStatusVariant(status?: string): StatusVariant {
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
      return "Доставлен"
    case "released":
      return "В релизе"
    case "Одобрен":
      return "Одобрен"
    case "В доставке":
    case "delivery":
      return "В доставке"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "На модерации"
    case "Отклонен":
    case "Отклонён":
      return "Отклонён"
    case "Снят":
      return "Снят"
    default:
      if (!status || status === "draft") return "Черновик"
      return status
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

function primaryIsrc(tracks: any[] | undefined): string | undefined {
  if (!Array.isArray(tracks)) return undefined
  const t = tracks.find((x) => x?.isrc)
  return t?.isrc as string | undefined
}

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

interface Props {
  artistId: string
  username: string
  mainArtistName: string
}

export default function ReleasesClient({ artistId, username, mainArtistName }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({
      artistId,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (debouncedQ) params.set("q", debouncedQ)
    return `/api/releases?${params}`
  }, [artistId, page, pageSize, debouncedQ])

  const { data, isLoading } = useReleasesList(listUrl)

  const releases = useMemo((): Release[] => {
    if (!data?.releases || !Array.isArray(data.releases)) return []
    return data.releases.map((release: Record<string, unknown>) => ({
      id: String(release.id),
      artistId: String(release.artistId ?? ""),
      title: String(release.title),
      type: release.type as string | undefined,
      coverUrl: release.coverUrl as string | undefined,
      upc: release.upc as string | undefined,
      releaseDate: String(release.releaseDate),
      status: release.status as string | undefined,
      tracks: (release.tracks as any[]) ?? [],
      trackCount: release.trackCount as number | undefined,
      primaryIsrc: release.primaryIsrc as string | undefined,
      featuredArtistNames: release.featuredArtistNames as string[] | undefined,
      artistDisplay: buildArtistDisplay(release, mainArtistName),
    }))
  }, [data, mainArtistName])

  const loading = isLoading
  const total = typeof data?.total === "number" ? data.total : releases.length

  const handleSearch = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val)
      setPage(1)
    }, 300)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pageNumbers = getPageNumbers(page, totalPages)

  // Единый русский формат DD.MM.YYYY (поддерживает и "DD.MM.YYYY", и ISO),
  // без английских «May 14, 2026» и «Invalid Date».
  const formatDate = (dateStr: string) => formatDateRu(dateStr, "--")

  return (
    <div className="max-w-full p-0 pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        {/* Breadcrumb */}
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
          <span className="text-white">Релизы</span>
        </div>

        {/* Page header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
              РЕЛИЗЫ
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Управляйте дискографией, отслеживайте статус доставки и мониторинг дистрибуции на всех цифровых платформах.
            </p>
          </div>

          <div className="w-full md:w-auto md:shrink-0 md:flex md:justify-end">
            <div className="relative group w-full md:w-64">
              <input
                type="text"
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Поиск по названию или UPC..."
                className="block w-full min-w-0 rounded-lg border border-white/10 bg-black/40 p-2.5 pl-10 font-mono text-sm text-white outline-none transition-all placeholder-gray-600 focus:border-[#10b981] focus:ring-[#10b981] group-hover:border-white/20"
              />
              <span
                className="material-symbols-outlined absolute left-3 top-2.5 text-gray-600 group-hover:text-gray-400 transition-colors"
                style={{ fontSize: 18 }}
              >
                search
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table container */}
      <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#10b981]/50 to-transparent" />

        <div>
          {loading && releases.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <span className="material-symbols-outlined animate-spin text-[#10b981] text-4xl">sync</span>
            </div>
          ) : releases.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-600 block mb-4">library_music</span>
              {debouncedQ ? (
                <>
                  <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Ничего не найдено</p>
                  <button
                    onClick={() => handleSearch("")}
                    className="mt-4 text-[#10b981] font-mono text-xs uppercase tracking-wider hover:underline"
                  >
                    Сбросить поиск
                  </button>
                </>
              ) : (
                <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Пока нет релизов</p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: карточки вместо таблицы */}
              <div className="space-y-3 p-3 md:hidden">
                {releases.map((release) => {
                  const isrc = release.primaryIsrc ?? primaryIsrc(release.tracks)
                  return (
                    <Link
                      key={release.id}
                      href={`/dashboard/artist/${username}/releases/${release.id}`}
                      className="block rounded-xl border border-white/5 bg-[#0a0a0a]/50 p-4 backdrop-blur-sm transition-colors hover:border-white/10"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                          {release.coverUrl ? (
                            <Image
                              src={release.coverUrl}
                              alt={release.title}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a]">
                              <span className="material-symbols-outlined text-gray-600" style={{ fontSize: 28 }}>
                                album
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold leading-snug text-white">{release.title}</div>
                          {release.type ? (
                            <div className="mt-0.5 font-mono text-xs uppercase tracking-wider text-gray-500">
                              {release.type}
                            </div>
                          ) : null}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-300 truncate">{release.artistDisplay}</p>
                            <div className="shrink-0">
                              <StatusBadge status={release.status} />
                            </div>
                          </div>
                        </div>
                        <span className="material-symbols-outlined shrink-0 text-gray-500" style={{ fontSize: 22 }}>
                          chevron_right
                        </span>
                      </div>
                      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-white/5 pt-3 text-[11px] font-mono">
                        <dt className="text-gray-500 uppercase tracking-wider">Дата</dt>
                        <dd className="text-right text-gray-200 tabular-nums">
                          {release.releaseDate ? formatDate(release.releaseDate) : "—"}
                        </dd>
                        <dt className="text-gray-500 uppercase tracking-wider">UPC</dt>
                        <dd className="break-all text-right text-gray-300">{release.upc || "—"}</dd>
                        <dt className="text-gray-500 uppercase tracking-wider">ISRC</dt>
                        <dd className="break-all text-right text-gray-300">{isrc || "—"}</dd>
                      </dl>
                    </Link>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-gray-500 border-b border-white/10 bg-black/40">
                  <th className="px-6 py-5 font-mono">Обложка</th>
                  <th className="px-6 py-5 font-mono">Название / версия</th>
                  <th className="px-6 py-5 font-mono">Артисты</th>
                  <th className="px-6 py-5 font-mono">UPC</th>
                  <th className="px-6 py-5 font-mono">Дата</th>
                  <th className="px-6 py-5 font-mono">Статус</th>
                  <th className="px-6 py-5 font-mono text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {releases.map((release) => (
                  <tr
                    key={release.id}
                    className="group border-b border-white/5 transition-all duration-200 table-row-hover hover:border-l-2 hover:border-l-[#10b981]/50 cursor-pointer"
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
                          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                            <span className="material-symbols-outlined text-gray-600" style={{ fontSize: 22 }}>album</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 hidden group-hover:flex items-center justify-center backdrop-blur-[1px]">
                          <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>play_arrow</span>
                        </div>
                      </div>
                    </td>

                    {/* Title / Version */}
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/artist/${username}/releases/${release.id}`}>
                        <div className="font-bold text-white group-hover:text-[#10b981] transition-colors leading-snug">
                          {release.title}
                        </div>
                        {release.type && (
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">{release.type}</div>
                        )}
                      </Link>
                    </td>

                    {/* Artists */}
                    <td className="px-6 py-4">
                      <div className="text-gray-300">{release.artistDisplay}</div>
                    </td>

                    {/* UPC */}
                    <td className="px-6 py-4 font-mono text-xs text-gray-400 tracking-wider">
                      {release.upc || "--"}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                      {release.releaseDate ? formatDate(release.releaseDate) : "--"}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={release.status} />
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/artist/${username}/releases/${release.id}`}
                        className="inline-flex text-gray-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_horiz</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination footer (inside table container) */}
        <div className="px-6 py-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-3 bg-black/20">
          <div className="text-xs text-gray-500 font-mono uppercase">
            {loading
              ? "Loading..."
              : `Showing ${from}–${to} of ${total} releases`}
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

            {/* Page navigation */}
            <button
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

            <button
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Footer status line */}
      <div className="mt-12 mb-6 flex justify-between items-center pt-6 text-sm md:mb-0">
        <div className="text-gray-500 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block animate-pulse" />
          System Online
        </div>
        <div className="text-gray-400 font-mono">
          TOTAL RELEASES:{" "}
          <span className="text-white font-bold">{total}</span>
        </div>
      </div>
    </div>
  )
}
