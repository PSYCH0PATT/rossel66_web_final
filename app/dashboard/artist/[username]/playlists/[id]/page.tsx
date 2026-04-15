import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { getSessionUser } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import Layout from "@/components/layout"
import { playlistRowVisibleToCabinetUser } from "@/lib/playlist-artist-match"
import { getPlaylistCoverUrl } from "@/lib/playlist-cover"
import type { ParsedTrack } from "@/lib/sftp-playlist-parser"

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
    select: { id: true, name: true, username: true },
  })
  if (!user) notFound()
  if (session.role === "artist" && session.id !== user.id) notFound()

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
  const cover = getPlaylistCoverUrl(playlist.platform)
  const listHref = `/dashboard/artist/${params.username}/playlists`
  const nameShort =
    playlist.playlistName.length > 40 ? `${playlist.playlistName.slice(0, 40)}…` : playlist.playlistName
  const badgeClass = platformBadgeClass(playlist.platform)
  const added = playlist.firstSeenDate || playlist.createdAt.toISOString().split("T")[0]

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="p-0 md:p-0 max-w-full pb-24">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2 min-w-0">
            <Link
              href={`/dashboard/artist/${params.username}/dashboard`}
              className="hover:text-[#10b981] cursor-pointer transition-colors flex-shrink-0"
            >
              Dashboard
            </Link>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <Link href={listHref} className="hover:text-[#10b981] cursor-pointer transition-colors flex-shrink-0">
              Плейлисты
            </Link>
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 10 }}>
              chevron_right
            </span>
            <span className="text-white truncate">{nameShort}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
          <div className="min-w-0">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">ПЛЕЙЛИСТ</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Карточка плейлиста и треки из отчёта площадки.
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex-shrink-0 ${badgeClass}`}
          >
            {playlist.platform}
          </span>
        </div>
      </div>

      <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 mb-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="relative w-full max-w-[220px] mx-auto lg:mx-0 aspect-square rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            <Image
              src={cover || "/placeholder.svg"}
              alt={playlist.playlistName}
              fill
              className="object-cover"
              sizes="220px"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight break-words">
              {playlist.playlistName}
            </h2>
            <p className="text-sm text-gray-400 font-mono">
              Артист в отчёте: <span className="text-gray-300">{playlist.artistName}</span>
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
              <span className="material-symbols-outlined text-lg text-gray-500">calendar_today</span>
              <span className="tabular-nums">Первый раз в отчёте: {added}</span>
            </div>
            {playlist.playlistUrl ? (
              <a
                href={playlist.playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#10b981] hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span className="material-symbols-outlined text-lg">open_in_new</span>
                Открыть на {playlist.platform}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-6">
          <span className="w-1.5 h-6 bg-accent-azure rounded-full" />
          ТРЕКИ В ПЛЕЙЛИСТЕ
        </h2>

        {tracks.length === 0 ? (
          <div className="card-glass rounded-2xl border border-white/5 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">queue_music</span>
            <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">Нет данных по трекам</p>
          </div>
        ) : (
          <div className="w-full rounded-xl overflow-hidden table-glass shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#10b981]/50 to-transparent" />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-widest text-gray-500 border-b border-white/10 bg-black/40">
                    <th className="px-6 py-4 font-mono">Трек</th>
                    <th className="px-6 py-4 font-mono">Артист</th>
                    <th className="px-6 py-4 font-mono text-center">Позиция</th>
                    <th className="px-6 py-4 font-mono">ISRC</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t, i) => (
                    <tr key={`${t.isrc}-${i}`} className="border-b border-white/5 table-row-hover">
                      <td className="px-6 py-3 text-white font-medium">{t.trackTitle || t.titleArtist}</td>
                      <td className="px-6 py-3 text-gray-400">{t.artistName}</td>
                      <td className="px-6 py-3 text-center text-gray-300 tabular-nums">{t.position}</td>
                      <td className="px-6 py-3 text-gray-500 font-mono text-xs">{t.isrc || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
