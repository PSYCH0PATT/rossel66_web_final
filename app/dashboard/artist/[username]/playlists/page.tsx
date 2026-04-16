import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { getCachedArtistPlaylists } from "@/lib/cached-dashboard"
import { getPlaylistCoverUrl } from "@/lib/playlist-cover"
import { getPlatformPartnerIconSrc } from "@/lib/platform-partner-icon"
import { getSessionUser } from "@/lib/server-auth"
import Layout from "@/components/layout"

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

  if (session.role === "artist" && session.id !== row.id) {
    notFound()
  }

  const playlists = await getCachedArtistPlaylists(row.id)
  const total = playlists.length

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
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
              const cover = getPlaylistCoverUrl(playlist.platform)
              const trackLine = firstTrackLabel(playlist.track_data)
              const releaseLine = firstReleaseLabel(playlist.track_data)
              const partnerIconSrc = getPlatformPartnerIconSrc(playlist.platform)
              const isVkSquareLogo = partnerIconSrc.endsWith("/vk-music.png")
              const subtitleLine = releaseLine || trackLine || "—"

              return (
                <a
                  key={playlist.id}
                  href={playlist.playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="artist-playlist-tile group relative aspect-square rounded-2xl overflow-hidden card-glass block outline-none ring-0 transition-[box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/60 isolate"
                >
                  {/* Весь контент карточки размывается при hover */}
                  <div className="absolute inset-0 z-0 transition-[filter] duration-300 ease-out group-hover:blur-[3px] group-hover:brightness-90">
                    <div className="absolute inset-0 z-0">
                      <Image
                        src={cover || "/placeholder.svg"}
                        alt={playlist.playlist_name}
                        fill
                        className="object-cover brightness-[0.88] grayscale-[12%]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>
                    <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/95 via-black/35 to-black/25" />

                    <div className="pointer-events-none absolute left-[12px] top-[12px] z-[3] aspect-square w-[12%] min-w-[1.25rem] max-w-[2rem] sm:max-w-[2.25rem]">
                      <div className="relative h-full w-full overflow-hidden rounded-full border border-white/30 bg-white/[0.14] shadow-[0_4px_20px_rgba(0,0,0,0.08)] backdrop-blur-xl">
                        <Image
                          src={partnerIconSrc}
                          alt=""
                          fill
                          className={
                            isVkSquareLogo
                              ? "object-cover"
                              : "object-contain p-[14%]"
                          }
                          sizes="(max-width: 640px) 12vw, 6vw"
                          unoptimized={partnerIconSrc.endsWith(".svg")}
                        />
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 z-[3] p-3">
                      <h3 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2">
                        {playlist.playlist_name}
                      </h3>
                      <p className="mt-1 text-xs text-gray-400 font-mono leading-snug line-clamp-2">
                        {subtitleLine}
                      </p>
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

        <div className="mt-12 mb-6 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-sm sm:flex-row md:mb-0">
          <div className="text-gray-500 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
            System Operational
          </div>
          <div className="text-gray-400 font-mono text-xs uppercase tracking-widest">
            TOTAL FOUND: <span className="text-white font-bold">{total}</span> PLAYLISTS
          </div>
        </div>
      </div>
    </Layout>
  )
}
