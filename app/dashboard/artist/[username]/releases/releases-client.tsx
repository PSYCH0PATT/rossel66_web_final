"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"

interface Release {
  id: string
  artistId: string
  title: string
  type?: string
  coverUrl?: string
  upc?: string
  releaseDate: string
  status?: string
  tracks: any[]
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
    case "released":
    case "Одобрен":
      return "Live"
    case "В доставке":
    case "delivery":
      return "Delivered"
    case "Модерируется":
    case "На модерации":
    case "moderation":
    case "scheduled":
      return "Moderation"
    case "Отклонен":
    case "Отклонён":
    case "Снят":
      return "Rejected"
    default:
      return status || "Draft"
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
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (val: string) => {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val)
      setPage(1)
    }, 300)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        artistId,
        page: String(page),
        pageSize: String(pageSize),
      })
      if (debouncedQ) params.set("q", debouncedQ)
      const res = await fetch(`/api/releases?${params}`)
      const data = await res.json()
      if (!data.success || !Array.isArray(data.releases)) {
        setReleases([])
        setTotal(0)
        return
      }
      const mapped: Release[] = data.releases.map((release: any) => ({
        id: release.id,
        artistId: release.artistId ?? "",
        title: release.title,
        type: release.type,
        coverUrl: release.coverUrl,
        upc: release.upc,
        releaseDate: release.releaseDate,
        status: release.status,
        tracks: release.tracks ?? [],
        featuredArtistNames: release.featuredArtistNames,
        artistDisplay: buildArtistDisplay(release, mainArtistName),
      }))
      setReleases(mapped)
      setTotal(typeof data.total === "number" ? data.total : mapped.length)
    } catch {
      setReleases([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [artistId, page, pageSize, debouncedQ, mainArtistName])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const pageNumbers = getPageNumbers(page, totalPages)

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return dateStr || "--"
    }
  }

  return (
    <div className="p-0 md:p-0 max-w-full pb-24">
      <div className="flex flex-col gap-6 mb-8">
        {/* Breadcrumb */}
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link
            href={`/dashboard/artist/${username}/dashboard`}
            className="hover:text-[#10b981] cursor-pointer transition-colors"
          >
            Dashboard
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Релизы</span>
        </div>

        {/* Page header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
              РЕЛИЗЫ
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Управляйте дискографией, отслеживайте статус доставки и мониторинг дистрибуции на всех цифровых платформах.
            </p>
          </div>

          <div className="flex w-full md:w-auto justify-end">
            <div className="relative group">
              <input
                type="text"
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Поиск по названию или UPC..."
                className="bg-black/40 border border-white/10 text-white text-sm rounded-lg focus:ring-[#10b981] focus:border-[#10b981] block w-full min-w-0 md:w-64 p-2.5 pl-10 placeholder-gray-600 font-mono transition-all group-hover:border-white/20 outline-none"
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

        <div className="overflow-x-auto">
          {loading && releases.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <span className="material-symbols-outlined animate-spin text-[#10b981] text-4xl">sync</span>
            </div>
          ) : releases.length === 0 ? (
            <div className="py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-600 block mb-4">library_music</span>
              <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">No releases found</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-gray-500 border-b border-white/10 bg-black/40">
                  <th className="px-6 py-5 font-mono">Cover</th>
                  <th className="px-6 py-5 font-mono">Title / Version</th>
                  <th className="px-6 py-5 font-mono">Artists</th>
                  <th className="px-6 py-5 font-mono">UPC</th>
                  <th className="px-6 py-5 font-mono">Date</th>
                  <th className="px-6 py-5 font-mono">Status</th>
                  <th className="px-6 py-5 font-mono text-center">Tracks</th>
                  <th className="px-6 py-5 font-mono text-right">Action</th>
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
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
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

                    {/* Tracks */}
                    <td className="px-6 py-4 text-center text-gray-400 font-mono">
                      {release.tracks?.length ?? 0}
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
      <div className="mt-12 flex justify-between items-center pt-6 text-sm">
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
