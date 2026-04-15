import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { getCachedArtistPlaylists } from "@/lib/cached-dashboard"
import { getPlaylistCoverUrl } from "@/lib/playlist-cover"
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

function platformDotColor(platform: string): string {
  switch (platform) {
    case "Яндекс Музыка":
      return "#FFCC00"
    case "Spotify":
      return "#1DB954"
    case "VK Музыка":
      return "#0077FF"
    case "Apple Music":
      return "#ffffff"
    default:
      return "#9ca3af"
  }
}

function relativeTimeLabel(dateRaw: string | Date | null | undefined): string {
  if (!dateRaw) return "—"
  const d = new Date(dateRaw)
  const now = Date.now()
  const diff = Math.max(0, now - d.getTime())
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`
  if (days < 30) return `${Math.floor(days / 7)} нед назад`
  return d.toLocaleDateString("ru-RU")
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
      <div className="p-0 md:p-0 max-w-full pb-24">
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link
              href={`/dashboard/artist/${params.username}/dashboard`}
              className="hover:text-[#10b981] cursor-pointer transition-colors"
            >
              Dashboard
            </Link>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <span className="text-white">Плейлисты</span>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">ПЛЕЙЛИСТЫ</h1>
              <p className="text-sm text-gray-400 font-light max-w-md">
                Плейлисты, в которые попали ваши треки на стриминговых платформах.
              </p>
            </div>
          </div>
        </div>

        {playlists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
            {playlists.map((playlist) => {
              const cover = getPlaylistCoverUrl(playlist.platform)
              const trackLine = firstTrackLabel(playlist.track_data)
              const dot = platformDotColor(playlist.platform)
              const dateRaw = playlist.last_seen_date || playlist.first_seen_date
              const dateLabel = dateRaw ? new Date(dateRaw).toLocaleDateString("ru-RU") : "—"
              const rel = relativeTimeLabel(dateRaw)

              return (
                <Link
                  href={`/dashboard/artist/${params.username}/playlists/${playlist.id}`}
                  key={playlist.id}
                  className="playlist-card group relative aspect-square rounded-2xl overflow-hidden cursor-pointer card-glass block"
                >
                  <div className="absolute inset-0 z-0">
                    <Image
                      src={cover || "/placeholder.svg"}
                      alt={playlist.playlist_name}
                      fill
                      className="object-cover transition-transform duration-700 ease-out filter brightness-[0.8] grayscale-[20%] playlist-cover-img"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>

                  <div className="playlist-overlay absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 flex flex-col justify-between p-5 z-10">
                    <div className="flex justify-start items-start">
                      <span className="platform-badge rounded px-2 py-1 text-[10px] uppercase font-bold text-white tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                        {playlist.platform}
                      </span>
                    </div>
                    <div className="self-center transform transition-transform group-hover:scale-110 duration-300">
                      <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors">
                        <span className="material-symbols-outlined text-3xl text-white group-hover:text-black ml-1">
                          play_arrow
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight mb-1 line-clamp-2">{playlist.playlist_name}</h3>
                      <p className="text-xs text-gray-400 font-mono line-clamp-2">
                        {trackLine || "Трек из плейлиста"} · {rel}
                      </p>
                    </div>
                  </div>

                  <div className="playlist-default-footer absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-[5] transition-opacity duration-300">
                    <h3 className="font-bold text-white text-lg truncate">{playlist.playlist_name}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">
                      {playlist.platform} · {dateLabel}
                    </p>
                  </div>
                </Link>
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

        <div className="mt-12 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-white/5 pt-6 text-sm">
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
