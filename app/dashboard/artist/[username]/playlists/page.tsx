import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { getCachedArtistPlaylists } from "@/lib/cached-dashboard"
import { getPlaylistCoverUrl } from "@/lib/playlist-cover"
import { PlaylistCoverImage } from "@/components/playlist-cover-image"
import { getSessionUser } from "@/lib/server-auth"
import { canViewArtistCabinet } from "@/lib/artist-links"
import { DashboardFooter } from "@/components/dashboard-footer"
function firstTrackLabel(trackDataJson: string): string {
  try {
    const arr = JSON.parse(trackDataJson || "[]") as { trackTitle?: string; titleArtist?: string }[]
    const t = arr[0]
    if (!t) return ""
    return (t.trackTitle || t.titleArtist || "").trim()
  } catch {
    return ""
  }
}

/** Подзаголовок карточки: предпочитаем название релиза из track_data */
function firstReleaseLabel(trackDataJson: string): string {
  try {
    const arr = JSON.parse(trackDataJson || "[]") as {
      albumTitle?: string
      album_title?: string
      trackTitle?: string
      titleArtist?: string
    }[]
    const t = arr[0]
    if (!t) return ""
    const album = (t.albumTitle || t.album_title || "").trim()
    if (album) return album
    return (t.trackTitle || t.titleArtist || "").trim()
  } catch {
    return ""
  }
}

export default async function PlaylistsPage({ params }: { params: { username: string } }) {
  const session = getSessionUser()
  if (!session) redirect("/dashboard/login")

  const row = await prisma.user.findFirst({
    where: { username: params.username, role: "artist" },
  })
  if (!row) notFound()

  if (!canViewArtistCabinet(session, row)) {
    notFound()
  }

  const playlists = await getCachedArtistPlaylists(row.id)
  const total = playlists.length

  return (
    <div className="max-w-full p-0 pb-6 md:pb-0">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link
              href={`/dashboard/artist/${params.username}/dashboard`}
              className="hover:text-[#10b981] cursor-pointer transition-colors"
            >
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <span className="text-white">Плейлисты</span>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">ПЛЕЙЛИСТЫ</h1>
              <p className="text-sm text-gray-400 font-light max-w-md">
                Плейлисты, в которые попали ваши треки на стриминговых платформах.
              </p>
            </div>
          </div>
        </div>

        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 mb-12">
            {playlists.map((playlist) => {
              const cover = getPlaylistCoverUrl(playlist.platform, playlist.cover_url)
              const trackLine = firstTrackLabel(playlist.track_data)
              const releaseLine = firstReleaseLabel(playlist.track_data)
              const subtitleLine = releaseLine || trackLine || "—"

              return (
                <a
                  key={playlist.id}
                  href={playlist.playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="artist-playlist-tile group relative aspect-square rounded-2xl overflow-hidden block outline-none ring-0 transition-[box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/60 isolate"
                >
                  {/* Рамка/градиент — не на том же слое, что blur (иначе у border-box иногда «просвечивают» прямые углы). */}
                  <div
                    className="pointer-events-none absolute inset-0 z-0 rounded-2xl card-glass"
                    aria-hidden
                  />
                  {/* clip-path + overflow: blur не вылезает за скругление; bg-card закрывает субпиксельные щели */}
                  <div className="absolute inset-0 z-[1] overflow-hidden rounded-2xl bg-card [clip-path:inset(0_round_1rem)] [transform:translateZ(0)]">
                    <div className="absolute inset-0 z-0 transition-[filter] duration-300 ease-out group-hover:blur-[3px] group-hover:brightness-90 [transform:translateZ(0)]">
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
                        <PlaylistCoverImage
                          src={cover || "/placeholder.svg"}
                          fallbackSrc={getPlaylistCoverUrl(playlist.platform, null)}
                          alt={playlist.playlist_name}
                          fill
                          className="object-cover brightness-[0.88] grayscale-[12%] rounded-2xl"
                          sizes="(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
                        />
                      </div>
                      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/95 via-black/35 to-black/25" />

                      <div className="absolute bottom-0 left-0 right-0 z-[3] p-3">
                        <h3 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2">
                          {playlist.playlist_name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-400 font-mono leading-snug line-clamp-2">
                          {subtitleLine}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* По центру — только при hover, без размытия */}
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  >
                    <span className="flex aspect-square w-[18%] min-w-[2.25rem] max-w-[3rem] items-center justify-center rounded-full border border-white/35 bg-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-2xl sm:max-w-[3.25rem]">
                      <span className="material-symbols-outlined text-2xl leading-none text-white sm:text-[26px]">
                        open_in_new
                      </span>
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 card-glass rounded-2xl border border-white/5 mb-12">
            <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 opacity-30">queue_music</span>
            <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">У вас пока нет плейлистов</p>
            <p className="text-[10px] text-gray-600 mt-2 text-center max-w-md px-4">
              Здесь будут отображаться плейлисты, в которые попали ваши треки.
            </p>
          </div>
        )}

        <DashboardFooter role="artist">
          {/* DS8: было «TOTAL FOUND: N PLAYLISTS» */}
          <div className="uppercase tracking-widest text-gray-400">
            Найдено: <span className="font-bold text-white">{total}</span>{" "}
            {total % 10 === 1 && total % 100 !== 11
              ? "плейлист"
              : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 12 || total % 100 > 14)
                ? "плейлиста"
                : "плейлистов"}
          </div>
        </DashboardFooter>
      </div>
    )
}
