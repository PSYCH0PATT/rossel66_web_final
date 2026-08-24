"use client"

import { useMemo, useRef, useState } from "react"
import { formatDateRu } from "@/lib/format-date"
import Image from "next/image"
import Link from "next/link"
import { ProfileFilter } from "@/components/profile-filter"
import { useReleasesList } from "@/lib/hooks/use-dashboard-fetch"
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
import { Pagination } from "@/components/ui/pagination"
import { SearchInput } from "@/components/ui/search-input"
import { Spinner } from "@/components/ui/spinner"
import { ReleaseStatusBadge } from "@/components/ui/status-badge"
import { releaseTrackCount } from "@/lib/release-status"

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

/**
 * Кто указан в колонке «Артисты».
 *
 * Основным берётся артист самого релиза (`artistName` из API), а не владелец
 * кабинета: в объединённом кабинете группы связанных профилей релизы принадлежат
 * разным профилям, и подпись именем главного была бы неверной.
 */
function buildArtistDisplay(release: any, fallbackName: string): string {
  const mainName = release.artistName || fallbackName
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

function primaryIsrc(tracks: any[] | undefined): string | undefined {
  if (!Array.isArray(tracks)) return undefined
  const t = tracks.find((x) => x?.isrc)
  return t?.isrc as string | undefined
}

const RELEASE_FORMS = ["релиз", "релиза", "релизов"] as const

interface Props {
  artistId: string
  username: string
  mainArtistName: string
}

export default function ReleasesClient({ artistId, username, mainArtistName }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState("")
  // Фильтр «Профиль» (AKA): "all" — релизы всех профилей группы.
  const [profileId, setProfileId] = useState("all")
  const [debouncedQ, setDebouncedQ] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({
      artistId,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (debouncedQ) params.set("q", debouncedQ)
    if (profileId !== "all") params.set("profileId", profileId)
    return `/api/releases?${params}`
  }, [artistId, page, pageSize, debouncedQ, profileId])

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

  // Единый русский формат DD.MM.YYYY (поддерживает и "DD.MM.YYYY", и ISO),
  // без английских «May 14, 2026» и «Invalid Date».
  const formatDate = (dateStr: string) => formatDateRu(dateStr, "--")

  const releaseHref = (id: string) => `/dashboard/artist/${username}/releases/${id}`

  return (
    <div className="space-y-8">
      <PageHeader
        title="РЕЛИЗЫ"
        subtitle="Управляйте дискографией, отслеживайте статус доставки и мониторинг дистрибуции на всех цифровых платформах."
        actionsClassName="w-full flex-col gap-2 md:w-auto md:flex-row md:justify-end"
        actions={
          <>
            <ProfileFilter
              value={profileId}
              onChange={(next) => {
                setProfileId(next)
                setPage(1)
              }}
              className="w-full md:w-56"
            />
            <SearchInput
              value={q}
              onValueChange={handleSearch}
              placeholder="Поиск по названию или UPC..."
              containerClassName="w-full md:w-64"
            />
          </>
        }
      />

      {/* Table container */}
      <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />

        <div>
          {loading && releases.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Spinner size="lg" />
            </div>
          ) : releases.length === 0 ? (
            <EmptyState
              className="py-20"
              icon="library_music"
              title={debouncedQ ? "Ничего не найдено" : "Пока нет релизов"}
              action={
                debouncedQ ? (
                  <Button variant="outline" onClick={() => handleSearch("")}>
                    Сбросить поиск
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTableResponsive
              cards={
                /* Mobile: карточки вместо таблицы */
                <div className="space-y-3 p-3">
                  {releases.map((release) => {
                    const isrc = release.primaryIsrc ?? primaryIsrc(release.tracks)
                    return (
                      <Link
                        key={release.id}
                        href={releaseHref(release.id)}
                        className="block rounded-xl border border-white/5 bg-surface-page/50 p-4 backdrop-blur-sm transition-colors hover:border-white/10"
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
                              <div className="flex h-full w-full items-center justify-center bg-surface-overlay">
                                <span className="material-symbols-outlined text-[28px] leading-none text-gray-600">
                                  album
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold leading-snug text-white">{release.title}</div>
                            {/*
                              F-73: слот версии рендерится всегда — при пустом
                              `type` он остаётся пустым, но высоту держит, и
                              карточки в списке перестают прыгать.
                            */}
                            <div className="mt-0.5 min-h-4 font-mono text-xs uppercase tracking-wider text-gray-500">
                              {release.type}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className="text-sm text-gray-300 truncate">{release.artistDisplay}</p>
                              <div className="shrink-0">
                                <ReleaseStatusBadge status={release.status} trackCount={releaseTrackCount(release.tracks)} />
                              </div>
                            </div>
                          </div>
                          <span className="material-symbols-outlined shrink-0 text-[22px] leading-none text-gray-500">
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
              }
              table={
                <DataTable tableClassName="text-left">
                  <DataTableHeader>
                    <DataTableHeadRow className="bg-black/40">
                      <DataTableHeadCell className="px-6 py-5">Обложка</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5">Название / версия</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5">Артисты</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5">UPC</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5">Дата</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5">Статус</DataTableHeadCell>
                      <DataTableHeadCell className="px-6 py-5 text-right">Действие</DataTableHeadCell>
                    </DataTableHeadRow>
                  </DataTableHeader>
                  <DataTableBody className="text-sm">
                    {releases.map((release) => (
                      // F-31: строка кликабельна целиком, а не «попади в название».
                      <DataTableRow key={release.id} href={releaseHref(release.id)} className="group">
                        <DataTableCell className="px-6 py-4">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden group-hover:ring-1 group-hover:ring-brand/50 transition-all flex-shrink-0">
                            {release.coverUrl ? (
                              <Image
                                src={release.coverUrl}
                                alt={release.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-surface-overlay flex items-center justify-center">
                                <span className="material-symbols-outlined text-[22px] leading-none text-gray-600">
                                  album
                                </span>
                              </div>
                            )}
                          </div>
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4">
                          <div className="font-bold text-white transition-colors group-hover:text-brand leading-snug">
                            {release.title}
                          </div>
                          {/* F-73: тот же фиксированный слот версии, что и в карточках. */}
                          <div className="min-h-4 text-xs text-gray-500 mt-0.5 font-mono">
                            {release.type}
                          </div>
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4">
                          <div className="text-gray-300">{release.artistDisplay}</div>
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4 font-mono text-xs text-gray-400 tracking-wider">
                          {release.upc || "--"}
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4 text-gray-400 font-mono text-xs">
                          {release.releaseDate ? formatDate(release.releaseDate) : "--"}
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4">
                          <ReleaseStatusBadge status={release.status} trackCount={releaseTrackCount(release.tracks)} />
                        </DataTableCell>

                        <DataTableCell className="px-6 py-4 text-right">
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-full text-gray-500"
                          >
                            <Link
                              href={releaseHref(release.id)}
                              aria-label={`Открыть релиз «${release.title}»`}
                            >
                              <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
                                more_horiz
                              </span>
                            </Link>
                          </Button>
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              }
            />
          )}
        </div>

        {/*
          C-06: счётчик, размер страницы и навигация — один компонент.
          При одной странице навигация скрывается целиком (F-26), счётчик
          остаётся единственным (F-27) и по-русски (F-11).
        */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20">
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            loading={loading}
            itemForms={RELEASE_FORMS}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </div>
      </div>

    </div>
  )
}
