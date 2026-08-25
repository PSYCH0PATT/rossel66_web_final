import { notFound, redirect } from "next/navigation"
import Image from "next/image"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import { prisma } from "@/lib/prisma"
import { playlistRowVisibleToCabinetUser } from "@/lib/playlist-artist-match"
import { getPlaylistCoverUrl } from "@/lib/playlist-cover"
import { formatDateRu } from "@/lib/format-date"
import { PlaylistCoverImage } from "@/components/playlist-cover-image"
import type { ParsedTrack } from "@/lib/sftp-playlist-parser"
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

function platformBadgeClass(platform: string): string {
  switch (platform) {
    case "Яндекс Музыка":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
    case "Spotify":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    case "VK Музыка":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20"
    case "Apple Music":
      return "bg-red-500/10 text-red-400 border-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-400 border-gray-500/20"
  }
}

export default async function ArtistPlaylistDetailPage({
  params,
}: {
  params: { username: string; id: string }
}) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const user = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
    select: { id: true, name: true, username: true, mainArtistId: true },
  })
  if (!user) notFound()
  if (!canViewArtistCabinet(session, user)) notFound()

  const playlist = await prisma.playlist.findUnique({
    where: { id: params.id },
  })
  if (!playlist) notFound()

  const allowed = playlistRowVisibleToCabinetUser(
    { artistName: playlist.artistName, artistId: playlist.artistId },
    user.id,
    user.name || "",
    user.username || ""
  )
  if (!allowed) notFound()

  const tracks = (playlist.trackData as unknown as ParsedTrack[]) || []
  const cover = getPlaylistCoverUrl(playlist.platform, playlist.coverUrl)
  const listHref = `/dashboard/artist/${params.username}/playlists`
  const badgeClass = platformBadgeClass(playlist.platform)
  // C-16/F-74: дата в интерфейсе всегда dd.mm.yyyy. В базе тут ISO-строка
  // («2026-08-25»), и она уходила на экран как есть — единственное место
  // кабинета, где формат остался машинным.
  const added = formatDateRu(playlist.firstSeenDate || playlist.createdAt)

  return (
    <div className="space-y-8">
      {/*
        C-01/F-24: H1 — имя сущности, а не тип экрана. До этого шапка держала
        генерик «ПЛЕЙЛИСТ», а настоящее название висело <h2> в карточке ниже —
        ровно тот случай, который канон закрыл на карте релиза (вердикт 3.4).
        Экран каждый раз снимался пустым («Нет данных по трекам»), поэтому в
        приёмку волн не попадал и остался последним генерик-заголовком кабинета.
      */}
      <PageHeader
        backHref={listHref}
        title={playlist.playlistName}
        titleStyle="entity"
        subtitle={`Плейлист ${playlist.platform} · треки из отчёта площадки`}
        actions={
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex-shrink-0 ${badgeClass}`}
          >
            {playlist.platform}
          </span>
        }
      />

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="relative w-full max-w-[220px] mx-auto lg:mx-0 aspect-square rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            <PlaylistCoverImage
              src={cover || "/placeholder.svg"}
              fallbackSrc={getPlaylistCoverUrl(playlist.platform, null)}
              alt={playlist.playlistName}
              fill
              className="object-cover"
              sizes="220px"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            {/*
              Название переехало в H1 шапки (см. выше) и здесь больше не
              повторяется — F-53: каждый факт на экране ровно один раз.
            */}
            <p className="text-sm text-gray-400 font-mono">
              Артист в отчёте: <span className="text-gray-300">{playlist.artistName}</span>
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
              <span className="material-symbols-outlined text-lg text-gray-500">calendar_today</span>
              <span className="tabular-nums">Первый раз в отчёте: {added}</span>
            </div>
            {playlist.playlistUrl ? (
              <Button asChild variant="cta">
                <a href={playlist.playlistUrl} target="_blank" rel="noopener noreferrer">
                  <span className="material-symbols-outlined text-lg" aria-hidden>
                    open_in_new
                  </span>
                  Открыть на {playlist.platform}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <SectionHeader className="mb-6" title="ТРЕКИ В ПЛЕЙЛИСТЕ" accent="azure" />

        {tracks.length === 0 ? (
          <div className="card-glass rounded-2xl border border-white/5">
            <EmptyState icon="queue_music" title="Нет данных по трекам" />
          </div>
        ) : (
          <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
            {/* C-10: скролл с видимым индикатором, первая колонка залипает на 390. */}
            <DataTable stickyFirstColumn tableClassName="text-left">
              <DataTableHeader>
                <DataTableHeadRow className="bg-black/40">
                  <DataTableHeadCell className="px-6 py-4">Трек</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4">Артист</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4 text-center">Позиция</DataTableHeadCell>
                  <DataTableHeadCell className="px-6 py-4">ISRC</DataTableHeadCell>
                </DataTableHeadRow>
              </DataTableHeader>
              <DataTableBody>
                {tracks.map((t, i) => (
                  <DataTableRow key={`${t.isrc}-${i}`}>
                    <DataTableCell className="px-6 py-3 text-white font-medium">{t.trackTitle || t.titleArtist}</DataTableCell>
                    <DataTableCell className="px-6 py-3 text-gray-400">{t.artistName}</DataTableCell>
                    <DataTableCell className="px-6 py-3 text-center text-gray-300 tabular-nums">{t.position}</DataTableCell>
                    <DataTableCell className="px-6 py-3 text-gray-500 font-mono text-xs">{t.isrc || "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        )}
      </div>

      </div>
    )
}
