"use client"

import { useState, useEffect } from "react"
import { formatDateRu } from "@/lib/format-date"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

type ReleasePreview = {
  id: string
  title: string
  coverUrl?: string | null
  releaseDate: string
}

export default function ArtistProfilePage({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [releases, setReleases] = useState<ReleasePreview[]>([])

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        const usersResponse = await fetch(
          `/api/users?username=${encodeURIComponent(params.username)}&role=artist`
        )
        const usersResult = await usersResponse.json()

        if (usersResult.success) {
          const foundArtist = usersResult.users?.[0]

          if (foundArtist) {
            setArtist(foundArtist)
            const relRes = await fetch(
              `/api/releases?artistId=${encodeURIComponent(foundArtist.id)}&page=1&pageSize=4`
            )
            const relJson = await relRes.json()
            if (relJson.success && Array.isArray(relJson.releases)) {
              setReleases(
                relJson.releases.slice(0, 4).map((r: any) => ({
                  id: r.id,
                  title: r.title,
                  coverUrl: r.coverUrl,
                  releaseDate: r.releaseDate,
                }))
              )
            } else {
              setReleases([])
            }
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных артиста:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtistData()
  }, [params.username])

  if (!loading && !artist) {
    notFound()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-gray-500">
          <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Loading…</span>
        </div>
      )
  }

  const dash = `/dashboard/artist/${params.username}/dashboard`
  const releasesHref = `/dashboard/artist/${params.username}/releases`
  const playlistsHref = `/dashboard/artist/${params.username}/playlists`

  return (
    
      <div className="p-0 md:p-0 max-w-full pb-6 md:pb-0">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
          <Link href={dash} className="hover:text-[#10b981] cursor-pointer transition-colors">
            ДАШБОРД
          </Link>
          <span className="material-symbols-outlined" style={{ fontSize: 10 }}>
            chevron_right
          </span>
          <span className="text-white">Профиль</span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">{artist.name}</h1>
            <p className="text-sm text-gray-400 font-light max-w-md">
              Публичная карточка и быстрые ссылки на релизы и плейлисты.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="w-full lg:w-1/3">
          <div className="card-glass rounded-2xl border border-white/5 p-8 text-center">
            <div className="relative w-24 h-24 rounded-full border-2 border-primary/50 overflow-hidden mx-auto mb-4">
              {artist.avatarUrl ? (
                artist.avatarUrl.startsWith("data:") ? (
                  <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Image src={artist.avatarUrl} alt="" fill className="object-cover" sizes="96px" />
                )
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white font-display">{artist.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <p className="text-xl font-bold text-white">{artist.name}</p>
            {artist.email && <p className="text-sm text-gray-400 mt-2 break-all">{artist.email}</p>}

            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {artist.vkMusicUrl && (
                <a
                  href={artist.vkMusicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 text-xs text-blue-400 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="material-symbols-outlined text-sm">library_music</span>
                  VK
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              )}
              {artist.yandexMusicUrl && (
                <a
                  href={artist.yandexMusicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 text-xs text-yellow-400 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="material-symbols-outlined text-sm">music_note</span>
                  Яндекс
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              )}
              {artist.spotifyUrl && (
                <a
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 text-xs text-emerald-400 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="material-symbols-outlined text-sm">graphic_eq</span>
                  Spotify
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-2/3 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                Последние релизы
              </h2>
              <Link
                href={releasesHref}
                className="text-xs text-primary hover:text-emerald-300 uppercase tracking-widest font-mono border-b border-primary/30 pb-0.5 hover:border-primary transition-all"
              >
                Все релизы
              </Link>
            </div>
            <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6">
              {releases.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {releases.map((release) => (
                    <Link
                      key={release.id}
                      href={`/dashboard/artist/${params.username}/releases/${release.id}`}
                      className="group flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/5 hover:border-primary/20 transition-all min-w-0"
                    >
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                        <Image
                          src={release.coverUrl || "/placeholder.svg"}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white text-sm truncate group-hover:text-[#10b981] transition-colors">
                          {release.title}
                        </p>
                        <p className="text-[10px] font-mono text-gray-500 tabular-nums">
                          {formatDateRu(release.releaseDate)}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-gray-600 group-hover:text-white text-sm flex-shrink-0">
                        chevron_right
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-gray-600 opacity-30 block mb-2">album</span>
                  <p className="text-gray-500 font-mono text-xs uppercase tracking-wider">Нет релизов</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                <span className="w-1.5 h-6 bg-accent-azure rounded-full" />
                Плейлисты
              </h2>
              <Link
                href={playlistsHref}
                className="text-xs text-primary hover:text-emerald-300 uppercase tracking-widest font-mono border-b border-primary/30 pb-0.5 hover:border-primary transition-all"
              >
                Все плейлисты
              </Link>
            </div>
            <div className="card-glass rounded-2xl border border-white/5 p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-gray-600 opacity-30 block mb-2">queue_music</span>
              <p className="text-gray-500 font-mono text-xs uppercase tracking-wider mb-2">Смотрите плейлисты</p>
              <p className="text-[10px] text-gray-600 mb-4">Полный список — на отдельной странице.</p>
              <Link
                href={playlistsHref}
                className="inline-flex items-center gap-2 text-xs text-primary font-mono uppercase tracking-widest border border-primary/30 rounded-lg px-4 py-2 hover:bg-primary/10 transition-colors"
              >
                Перейти к плейлистам
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
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
    )
}
