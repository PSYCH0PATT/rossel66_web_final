"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DashboardFooter } from "@/components/dashboard-footer"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableRow,
} from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { ReleaseStatusBadge } from "@/components/ui/status-badge"
import { releaseTrackCount, trackDurationText } from "@/lib/release-status"

function parseDurationSeconds(duration?: string | number): number {
  if (duration == null || duration === "") return 0
  const parts = String(duration).split(":").map((p) => Number(p.trim()))
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 1) return parts[0] // число секунд, напр. "215"
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
        const releaseResponse = await fetch(`/api/releases/${params.id}`)
        
        if (releaseResponse.status === 404 || releaseResponse.status === 403) {
          setLoading(false)
          return
        }

        const releaseData = await releaseResponse.json()

        if (!releaseData.success) {
          setLoading(false)
          return
        }

        setRelease(releaseData.release)
        setArtist({ name: releaseData.release.artistName || params.username })
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" label="Загрузка…" />
      </div>
    )
  }

  if (!artist || !release) {
    return (
      <EmptyState
        className="min-h-[40vh]"
        icon="error"
        title="Релиз не найден"
        description="Релиз удален или у вас нет прав на его просмотр."
        action={
          <Button asChild variant="outline">
            <Link href={`/dashboard/artist/${params.username}/releases`}>Вернуться к релизам</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          aria-label="Назад"
          className="self-start rounded-lg border border-white/10 font-mono text-xs uppercase tracking-widest text-gray-500 hover:text-primary"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            arrow_back
          </span>
          Назад
        </Button>
      </div>

      <PageHeader
        className="mb-8"
        title="РЕЛИЗ"
        subtitle="Карточка релиза, треки и технические данные дистрибуции."
        actions={<ReleaseStatusBadge status={release.status} trackCount={releaseTrackCount(tracks)} />}
      />

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
            {/*
              F-52: название релиза больше не печатается дисплейным шрифтом.
              Syncopate — капс-шрифт без строчных и без «ё»: пользовательская
              строка «Я всё ещё одна» превращалась в «я все еще одна».
            */}
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
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
        <SectionHeader className="mb-6" title="ТРЕКИ" />

        {tracks.length > 0 ? (
          <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
            {/*
              C-10: горизонтальный скролл теперь с видимым скроллбаром и тенями
              у краёв, первая колонка залипает — на 390 таблица шире вьюпорта,
              и «Длительность» раньше просто обрезалась без аффорданса.
            */}
            <DataTable stickyFirstColumn tableClassName="text-left">
              <DataTableHeader>
                <DataTableHeadRow className="bg-black/40">
                  <DataTableHeadCell className="w-14 px-6 py-4">#</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4">Название</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4">ISRC</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4 text-right">Длительность</DataTableHeadCell>
                </DataTableHeadRow>
              </DataTableHeader>
              <DataTableBody className="text-sm">
                {tracks.map((track: any, index: number) => (
                  <DataTableRow key={track.id ?? index} className="group">
                    <DataTableCell className="px-6 py-3 text-gray-400 font-mono tabular-nums">
                      {index + 1}
                    </DataTableCell>
                    <DataTableCell className="px-6 py-3">
                      <div className="font-bold text-white transition-colors group-hover:text-brand min-w-0 break-words">
                        {track.title}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="px-6 py-3 font-mono text-xs text-gray-400 tracking-wider tabular-nums">
                      {track.isrc || "—"}
                    </DataTableCell>
                    <DataTableCell className="px-6 py-3 text-right text-gray-400 font-mono text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <span className="material-symbols-outlined text-base text-gray-500">schedule</span>
                        {trackDurationText(track.duration)}
                      </span>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        ) : (
          <div className="card-glass rounded-2xl border border-white/5">
            <EmptyState
              icon="music_off"
              title="Треки не загружены"
              description="Список треков пуст или не был импортирован."
            />
          </div>
        )}
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

      <DashboardFooter role="artist" />
    </div>
  )
}
