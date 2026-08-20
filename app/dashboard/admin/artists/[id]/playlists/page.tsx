"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { Banner } from "@/components/ui/banner"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Spinner } from "@/components/ui/spinner"
import { formatDateRu } from "@/lib/format-date"

export default function ArtistPlaylistsPage({ params }: { params: { id: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const fetchArtistAndPlaylists = async () => {
      try {
        const artistsRes = await fetch(
          `/api/artists?id=${encodeURIComponent(params.id)}`
        )
        const artistsData = await artistsRes.json()
        if (!artistsData.success || cancelled) return

        const foundArtist = artistsData.artists?.[0]
        if (!foundArtist) {
          setError("Артист не найден")
          setLoading(false)
          return
        }

        setArtist(foundArtist)

        const playlistsRes = await fetch(`/api/playlists/sftp?artistId=${encodeURIComponent(params.id)}`)
        const playlistsData = await playlistsRes.json()
        if (cancelled) return
        if (playlistsData.success && Array.isArray(playlistsData.results)) {
          setPlaylists(playlistsData.results)
        } else {
          setPlaylists([])
        }
      } catch (e) {
        if (!cancelled) setError("Ошибка загрузки данных")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchArtistAndPlaylists()
    return () => { cancelled = true }
  }, [params.id])

  const handleDeletePlaylist = (playlistId: number) => {
    setPlaylists((prev) => prev.filter((p: any) => p.id !== playlistId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      )
  }

  if (error || !artist) {
    return (
      
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>arrow_back</span>
              <span>Назад к списку артистов</span>
            </Link>
          </div>
          <Banner variant="danger">{error || "Артист не найден"}</Banner>
        </div>
      )
  }

  return (
    
      <div className="space-y-6">
        <PageHeader
          size="md"
          backHref={`/dashboard/admin/artists/${params.id}`}
          backLabel="Назад к профилю артиста"
          title={`Плейлисты артиста: ${artist?.name ?? ""}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="card-glass rounded-2xl border border-white/5 p-6">
              <SectionHeader title={`Плейлисты (${playlists.length})`} />
              {playlists.length > 0 ? (
                  <div className="space-y-4">
                    {playlists.map((playlist: any) => (
                      <div key={playlist.id} className="rounded-lg border border-white/5 bg-surface-raised/60 p-4 relative group">
                        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
                          <Button
                            variant="destructive-outline"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Удалить плейлист ${playlist.playlist_name ?? ""}`}
                            onClick={() => handleDeletePlaylist(playlist.id)}
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden>delete</span>
                          </Button>
                        </div>

                        <div className="flex gap-4">
                          <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={playlist.playlist_cover_url || "/placeholder.svg"}
                              alt={playlist.playlist_name || ""}
                              fill
                              className="object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{playlist.playlist_name}</h3>
                            <p className="text-sm text-gray-400 mb-1">{playlist.platform}</p>
                            <p className="text-xs text-gray-500 mb-2">
                              Треков: {playlist.tracks_count ?? 0}
                              {playlist.track_position != null && !isNaN(playlist.track_position) && (
                                <> · Позиция: {playlist.track_position}</>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mb-2">
                              {/* C-16/F-74: было сырое значение из выгрузки, теперь всегда dd.mm.yyyy. */}
                              Добавлен: {formatDateRu(playlist.added_at || playlist.parsed_at)}
                            </p>

                            {playlist.playlist_url && (
                              <a
                                href={playlist.playlist_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 text-status-info hover:text-sky-300"
                              >
                                <span className="material-symbols-outlined text-sm" aria-hidden>open_in_new</span>
                                Открыть в {playlist.platform}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    className="py-8"
                    icon="queue_music"
                    title="У артиста нет плейлистов"
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    )
}
