"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { getArtistPlaylists, getTrackById, users } from "@/lib/data"
import { Music, Calendar } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function PlaylistsPage({ params }: { params: { username: string } }) {
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

  const playlists = getArtistPlaylists(artistId)

  // Цвета для платформ
  const platformColors = {
    "Яндекс Музыка": "bg-category-amber text-black",
    Spotify: "bg-category-green text-black",
    "VK Музыка": "bg-category-blue text-white",
    "Apple Music": "bg-category-red text-white",
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Плейлисты</h1>

        {playlists.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {playlists.map((playlist) => {
              // Получение информации о треке и релизе
              const trackInfo = getTrackById(playlist.trackId)

              return (
                <Link href={`/artist/${params.username}/playlists/${playlist.id}`} key={playlist.id}>
                  <Card className="bg-card border-border text-card-foreground overflow-hidden rounded-xl hover:border-category-red/50 transition-colors cursor-pointer">
                    <div className="aspect-square relative">
                      <Image
                        src={playlist.imageUrl || "/placeholder.svg"}
                        alt={playlist.name}
                        fill
                        className="object-cover"
                      />
                      <Badge
                        className={`absolute top-2 right-2 rounded-xl text-xs ${platformColors[playlist.platform as keyof typeof platformColors] || "bg-gray-500"}`}
                      >
                        {playlist.platform}
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <h2 className="text-sm font-bold mb-1 line-clamp-1">{playlist.name}</h2>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1">
                          <Music className="h-3 w-3 text-category-blue" />
                          <span className="text-muted-foreground line-clamp-1">
                            {trackInfo ? `${trackInfo.track.title}` : `Трек: ${playlist.trackId}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-category-amber" />
                          <span className="text-muted-foreground">
                            {new Date(playlist.addedDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="bg-card border-border text-card-foreground rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">У вас пока нет плейлистов</h2>
            <p className="text-muted-foreground">Здесь будут отображаться плейлисты, в которые попали ваши треки.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
