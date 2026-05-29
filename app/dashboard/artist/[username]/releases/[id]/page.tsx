"use client"

import { useState, useEffect, useMemo } from "react"
import Layout from "@/components/layout"
import Image from "next/image"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"

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

function parseDurationSeconds(duration?: string): number {
  if (!duration || typeof duration !== "string") return 0
  const parts = duration.split(":").map((p) => Number(p.trim()))
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function formatSeconds(total: number): string {
  if (total <= 0) return "—"
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—"
  try {
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.')
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("ru-RU")
        }
      }
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr || "—"
    return d.toLocaleDateString("ru-RU")
  } catch {
    return dateStr || "—"
  }
}

export default function ArtistReleaseDetailPage({ params }: { params: { username: string; id: string } }) {
  const router = useRouter()
  const [release, setRelease] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersResponse = await fetch(
          `/api/users?username=${encodeURIComponent(params.username)}&role=artist`
        )
        const usersData = await usersResponse.json()

        if (!usersData.success) {
          setLoading(false)
          return
        }

        const foundArtist = usersData.users?.[0]

        if (!foundArtist) {
          setLoading(false)
          return
        }

        setArtist(foundArtist)

        const releaseResponse = await fetch(`/api/releases/${params.id}`)
        const releaseData = await releaseResponse.json()

        if (!releaseData.success || releaseData.release.artistId !== foundArtist.id) {
          setLoading(false)
          return
        }

        setRelease(releaseData.release)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setLoading(false)
      }
    }

    fetchData()
  }, [params.username, params.id])

  const tracks = release?.tracks ?? []
  const totalDurationSec = useMemo(
    () => tracks.reduce((acc: number, t: any) => acc + parseDurationSeconds(t?.duration), 0),
    [tracks]
  )
  const isrcCount = useMemo(() => tracks.filter((t: any) => t?.isrc).length, [tracks])

  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-500">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Loading…</span>
        </div>
      </Layout>
    )
  }

  if (!artist || !release) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <div className="text-red-500/85 p-3 bg-red-500/10 rounded-full border border-red-500/20">
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>error</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-white text-lg font-medium">Релиз не найден</h3>
            <p className="text-gray-400 text-sm max-w-sm">
              Релиз удален или у вас нет прав на его просмотр.
            </p>
          </div>
          <Link
            href={`/dashboard/artist/${params.username}/releases`}
            className="text-xs text-primary font-mono uppercase tracking-widest border border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-lg px-4 py-2 mt-2 transition-all duration-300"
          >
            Вернуться к релизам
          </Link>
        </div>
      </Layout>
    )
  }

  const dashHref = `/dashboard/artist/${params.username}/dashboard`
  const releasesHref = `/dashboard/artist/${params.username}/releases`
  const titleShort =
    release.title.length > 32 ? `${release.title.slice(0, 32)}…` : release.title

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href={dashHref} className="hover:text-[#10b981] cursor-pointer transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <Link href={releasesHref} className="hover:text-[#10b981] cursor-pointer transition-colors">
              Релизы
            </Link>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <span className="text-white truncate max-w-[200px]">{titleShort}</span>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs text-gray-500 hover:text-primary font-mono uppercase tracking-widest border border-white/10 rounded-lg px-3 py-2 inline-flex items-center gap-2 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Назад"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Назад
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div className="min-w-0">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">РЕЛИЗ</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Карточка релиза, треки и технические данные дистрибуции.
            </p>
          </div>
          <StatusBadge status={release.status} />
        </div>
      </div>

      {/* Hero */}
      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="relative w-full max-w-[220px] mx-auto lg:mx-0 aspect-square rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            <Image
              src={release.coverUrl || "/placeholder.svg"}
              alt={release.title}
              fill
              className="object-cover"
              sizes="220px"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
              {release.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className="material-symbols-outlined text-primary text-lg">person</span>
                {artist.name}
              </span>
              {release.type && (
                <span className="text-xs text-gray-500 font-mono uppercase">{release.type}</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-gray-500 text-lg mt-0.5">qr_code</span>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">UPC</p>
                  <p className="font-mono text-white tabular-nums">{release.upc || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-gray-500 text-lg mt-0.5">calendar_today</span>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Дата релиза</p>
                  <p className="text-white tabular-nums">
                    {formatDate(release.releaseDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks table */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            ТРЕКИ
          </h2>
        </div>
        <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#10b981]/50 to-transparent" />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-gray-500 border-b border-white/10 bg-black/40">
                  <th className="px-6 py-4 font-mono w-14">#</th>
                  <th className="px-6 py-4 font-mono">Название</th>
                  <th className="px-6 py-4 font-mono">ISRC</th>
                  <th className="px-6 py-4 font-mono text-right">Длительность</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {tracks.map((track: any, index: number) => (
                  <tr
                    key={track.id ?? index}
                    className="group border-b border-white/5 transition-all duration-200 table-row-hover"
                  >
                    <td className="px-6 py-3 text-gray-400 font-mono tabular-nums">{index + 1}</td>
                    <td className="px-6 py-3">
                      <div className="font-bold text-white group-hover:text-[#10b981] transition-colors min-w-0 break-words">
                        {track.title}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-400 tracking-wider tabular-nums">
                      {track.isrc || "—"}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-400 font-mono text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <span className="material-symbols-outlined text-base text-gray-500">schedule</span>
                        {track.duration || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tech + stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="stat-card-glass p-6 rounded-2xl border border-white/5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">info</span>
            Техническая информация
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">ID релиза</dt>
              <dd className="font-mono text-sm text-white break-all mt-1">{release.id}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">UPC</dt>
              <dd className="font-mono text-sm text-white tabular-nums mt-1">{release.upc || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Дата релиза</dt>
              <dd className="text-sm text-white mt-1 tabular-nums">
                {formatDate(release.releaseDate)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="stat-card-glass p-6 rounded-2xl border border-white/5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-azure text-lg">bar_chart</span>
            Статистика
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Треков</p>
              <p className="text-3xl font-bold text-white font-display tabular-nums mt-1">{tracks.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">С ISRC</p>
              <p className="text-3xl font-bold text-white font-display tabular-nums mt-1">{isrcCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Длительность</p>
              <p className="text-xl font-bold text-white font-display tabular-nums mt-1">
                {formatSeconds(totalDurationSec)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center text-sm border-t border-white/5 pt-6">
        <div className="text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary inline-block mr-2 animate-pulse" />
          System Operational
        </div>
        <div className="text-gray-400 font-mono text-xs">ROSSEL LABEL ENGINE V2.4</div>
      </div>
      </div>
    </Layout>
  )
}
