"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react"
import { VkParserForm } from "@/components/vk-parser-form"
import Image from "next/image"
import Link from "next/link"

export default function ArtistPlaylistsPage({ params }: { params: { id: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const fetchArtistAndPlaylists = async () => {
      try {
        const artistsRes = await fetch("/api/artists")
        const artistsData = await artistsRes.json()
        if (!artistsData.success || cancelled) return

        const foundArtist = artistsData.artists.find((a: any) => a.id === params.id && a.role === "artist")
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
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      </Layout>
    )
  }

  if (error || !artist) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад к списку артистов</span>
            </Link>
          </div>
          <div className="text-center py-8 text-gray-400">
            <p>{error || "Артист не найден"}</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/admin/artists/${params.id}`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад к профилю артиста</span>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white">Плейлисты артиста: {artist?.name}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle>Плейлисты ({playlists.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {playlists.length > 0 ? (
                  <div className="space-y-4">
                    {playlists.map((playlist: any) => (
                      <div key={playlist.id} className="bg-accent/30 rounded-lg p-4 relative group">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-900/20"
                            onClick={() => handleDeletePlaylist(playlist.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
                              Добавлен: {playlist.added_at || playlist.parsed_at || "—"}
                            </p>

                            {playlist.playlist_url && (
                              <a
                                href={playlist.playlist_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Открыть в {playlist.platform}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>У артиста нет плейлистов</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <VkParserForm artistId={params.id} artistName={artist?.name || ""} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
