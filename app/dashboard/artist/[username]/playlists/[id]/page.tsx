"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { playlists, getTrackById, users } from "@/lib/data"
import { Music, Calendar, ExternalLink, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function PlaylistDetailPage({ params }: { params: { username: string; id: string } }) {
  const [artistId, setArtistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Находим артиста по username из URL
    const artist = users.find((user) => user.username === params.username && user.role === "artist")

    // Проверяем динамически добавленных артистов
    if (!artist) {
      const dynamicUsersStr = localStorage.getItem("dynamicUsers")
      const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []
      const dynamicArtist = dynamicUsers.find(
        (user: any) => user.username === params.username && user.role === "artist",
      )

      if (dynamicArtist) {
        setArtistId(dynamicArtist.id)
      }
    } else {
      setArtistId(artist.id)
    }

    setLoading(false)
  }, [params.username])

  // Если артист не найден
  if (!loading && !artistId) {
    notFound()
  }

  // Если еще загружается
  if (loading || !artistId) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  const playlist = playlists.find((p) => p.id === params.id && p.artistId === artistId)

  if (!playlist) {
    notFound()
  }

  // Get track and release info
  const trackInfo = getTrackById(playlist.trackId)

  // Platform badge colors
  const platformColors = {
    "Яндекс Музыка": "bg-category-amber text-black",
    Spotify: "bg-category-green text-black",
    "VK Музыка": "bg-category-blue text-white",
    "Apple Music": "bg-category-red text-white",
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/artist/${params.username}/playlists`}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад к плейлистам</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Playlist Cover and Info */}
          <div className="md:col-span-1">
            <Card className="bg-card border-border text-card-foreground overflow-hidden rounded-xl">
              <div className="aspect-square relative">
                <Image
                  src={playlist.imageUrl || "/placeholder.svg"}
                  alt={playlist.name}
                  fill
                  className="object-cover"
                />
                <Badge
                  className={`absolute top-2 right-2 rounded-xl ${
                    platformColors[playlist.platform as keyof typeof platformColors] || "bg-gray-500"
                  }`}
                >
                  {playlist.platform}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h1 className="text-xl font-bold mb-2">{playlist.name}</h1>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-category-amber" />
                    <span className="text-muted-foreground">
                      Добавлен: {new Date(playlist.addedDate).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-muted-foreground mt-2">{playlist.description}</p>

                  <button className="w-full flex items-center justify-center gap-2 p-2 mt-2 bg-accent/50 hover:bg-accent/70 rounded-xl transition-colors">
                    <ExternalLink className="h-4 w-4 text-category-blue" />
                    <span>Открыть в {playlist.platform}</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Track Info */}
          <div className="md:col-span-2">
            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-category-blue" />
                  Информация о треке
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trackInfo ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-accent/30">
                      <h3 className="font-medium text-white mb-1">{trackInfo.track.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Из релиза: <span className="text-category-blue">{trackInfo.release.title}</span>
                      </p>
                      {trackInfo.track.isrc && (
                        <p className="text-sm text-muted-foreground">ISRC: {trackInfo.track.isrc}</p>
                      )}
                      <p className="text-sm text-muted-foreground">Длительность: {trackInfo.track.duration}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-accent/30">
                      <h3 className="font-medium text-white mb-2">О релизе</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">UPC</p>
                          <p className="text-sm">{trackInfo.release.upc}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Дата релиза</p>
                          <p className="text-sm">{new Date(trackInfo.release.releaseDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Статус</p>
                          <p className="text-sm capitalize">{trackInfo.release.status}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Треков в релизе</p>
                          <p className="text-sm">{trackInfo.release.tracks.length}</p>
                        </div>
                      </div>
                    </div>

                    <Link href={`/artist/${params.username}/releases/${trackInfo.release.id}`}>
                      <button className="w-full flex items-center justify-center gap-2 p-2 bg-category-blue text-black rounded-xl hover:bg-category-blue/80 transition-colors">
                        <Music className="h-4 w-4" />
                        <span>Перейти к релизу</span>
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-900/30 border border-red-900/50">
                    <p className="text-white">Информация о треке не найдена</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
