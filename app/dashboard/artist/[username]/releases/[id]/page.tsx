"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableHeadRow,
  DataTableResponsive,
  DataTableRow,
} from "@/components/ui/data-table"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { ReleaseStatusBadge } from "@/components/ui/status-badge"
import {
  releaseStatusVariant,
  releaseTrackCount,
  releaseTypeLabel,
  trackDurationText,
} from "@/lib/release-status"
import { releaseArtistsLine } from "@/lib/release-artists"
import { formatDateRu } from "@/lib/format-date"
import { pluralize } from "@/lib/plural"

/**
 * Карта релиза артиста — целевой макет вердикта 3.4 (docs/ia-decisions.md).
 *
 * Было пять карточек, в которых ровно один новый факт: генерик-H1 «РЕЛИЗ»
 * ~64px конкурировал с названием в хиро, «Техническая информация» повторяла
 * UPC и дату экраном выше и добавляла админский «ID релиза», «Статистика»
 * стояла отдельной полупустой карточкой, а треки — единственное, чего нет
 * в списке релизов, — начинались с третьего экрана.
 *
 * Стало три блока без единого дубля: шапка (название + статус), хиро с
 * фактами релиза и треки сразу под ней. Каждый показанный факт встречается
 * на экране ровно один раз.
 */

const TRACK_FORMS = ["трек", "трека", "треков"] as const

function parseDurationSeconds(duration?: string | number): number {
  if (duration == null || duration === "") return 0
  const parts = String(duration).split(":").map((p) => Number(p.trim()))
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 1) return parts[0] // число секунд, напр. "215"
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

/** Суммарная длительность; неизвестная — «—», а не выдуманный ноль (F-93). */
function formatSeconds(total: number): string {
  if (total <= 0) return "—"
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

/** Пара «подпись — значение» правой половины хиро (бывшая пустая зона, F-10). */
function ReleaseFact({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 break-words text-white">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

export default function ArtistReleaseDetailPage({ params }: { params: { username: string; id: string } }) {
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

  const knownTracks = releaseTrackCount(tracks)
  const typeLabel = releaseTypeLabel(release.type)
  const artistsLine = releaseArtistsLine(release, artist.name)
  const releaseDate = release.releaseDate ? formatDateRu(release.releaseDate) : "—"
  /** У релиза «В доставке» UPC ещё не присвоен — это состояние, а не дыра. */
  const inDelivery =
    releaseStatusVariant(release.status, { trackCount: knownTracks }) === "delivered"

  // Подпись шапки: тип · артисты · дата — одной строкой вместо трёх карточек.
  const subtitle = [typeLabel, artistsLine, releaseDate !== "—" ? releaseDate : ""]
    .filter(Boolean)
    .join(" · ")

  // Сводка бывшей карточки «Статистика» — в заголовок секции «Треки» (C-18).
  const tracksSummary = [
    pluralize(tracks.length, TRACK_FORMS),
    `ISRC: ${isrcCount > 0 ? `${isrcCount} из ${tracks.length}` : "—"}`,
    `длительность: ${formatSeconds(totalDurationSec)}`,
  ].join(" · ")

  return (
    <div className="space-y-8">
      {/* Блок 1 — шапка: H1 = название релиза, статус вплотную к нему. */}
      <PageHeader
        backHref={`/dashboard/artist/${params.username}/releases`}
        backLabel="Назад"
        title={release.title}
        titleStyle="entity"
        titleBadge={
          <ReleaseStatusBadge status={release.status} trackCount={knownTracks} />
        }
        subtitle={subtitle}
      />

      {/* Блок 2 — хиро: обложка и факты релиза, каждый по одному разу. */}
      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/*
            На 390 обложка ограничена по ширине: во всю ширину экрана она
            уводила название и статус за первый экран (вердикт 3.4, п.5).
          */}
          <div className="relative mx-auto aspect-square w-full max-w-[160px] flex-shrink-0 overflow-hidden rounded-xl border border-white/10 sm:max-w-[220px] lg:mx-0">
            <Image
              src={release.coverUrl || "/placeholder.svg"}
              alt={release.title}
              fill
              className="object-cover"
              sizes="220px"
            />
          </div>
          <dl className="grid min-w-0 flex-1 grid-cols-1 gap-5 text-sm sm:grid-cols-2">
            <ReleaseFact
              label="UPC"
              hint={!release.upc && inDelivery ? "Будет присвоен после доставки" : undefined}
            >
              <span className="font-mono tabular-nums">{release.upc || "—"}</span>
            </ReleaseFact>
            <ReleaseFact label="Дата релиза">
              <span className="tabular-nums">{releaseDate}</span>
            </ReleaseFact>
            {typeLabel && <ReleaseFact label="Тип">{typeLabel}</ReleaseFact>}
            {/* F-91: имена строкой, а не чипом, который выглядел кнопкой. */}
            <ReleaseFact label="Артисты">{artistsLine}</ReleaseFact>
          </dl>
        </div>
      </div>

      {/* Блок 3 — треки: единственный контент, которого нет в списке релизов. */}
      <div>
        <SectionHeader
          className="mb-6"
          title={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              Треки
              <span className="font-mono text-xs font-normal uppercase tracking-widest text-gray-500">
                {tracksSummary}
              </span>
            </span>
          }
        />

        {tracks.length > 0 ? (
          <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
            <DataTableResponsive
              cards={
                /* На 390 таблица была шире вьюпорта и «Длительность» обрезалась
                   без всякого аффорданса — те же данные карточками (F-77). */
                <div className="space-y-3 p-3">
                  {tracks.map((track: any, index: number) => (
                    <div
                      key={track.id ?? index}
                      className="rounded-xl border border-white/5 bg-surface-page/50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs tabular-nums text-gray-500">
                          {index + 1}
                        </span>
                        <p className="min-w-0 flex-1 break-words font-bold text-white">
                          {track.title}
                        </p>
                      </div>
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-white/5 pt-3 font-mono text-[11px]">
                        <dt className="uppercase tracking-wider text-gray-500">ISRC</dt>
                        <dd className="break-all text-right text-gray-300">{track.isrc || "—"}</dd>
                        <dt className="uppercase tracking-wider text-gray-500">Длительность</dt>
                        <dd className="text-right tabular-nums text-gray-300">
                          {trackDurationText(track.duration)}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>
              }
              table={
                <DataTable tableClassName="text-left">
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
              }
            />
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
    </div>
  )
}
