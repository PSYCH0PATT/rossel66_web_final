"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Music, ExternalLink } from "lucide-react"

export default function ArtistProfilePage({ params }: { params: { username: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [releases, setReleases] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])

  useEffect(() => {
    const fetchArtistData = async () => {
      try {
        // Получаем всех пользователей через API
        const usersResponse = await fetch('/api/users')
        const usersResult = await usersResponse.json()
        
        if (usersResult.success) {
          const foundArtist = usersResult.users.find(
            (a: any) => a.username === params.username && a.role === "artist"
          )
          
          if (foundArtist) {
            setArtist(foundArtist)
            // TODO: Загрузить релизы и плейлисты через API когда они будут готовы
            setReleases([])
            setPlaylists([])
          }
        }
      } catch (error) {
        console.error('Ошибка при загрузке данных артиста:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchArtistData()
  }, [params.username])

  // Если артист не найден
  if (!loading && !artist) {
    notFound()
  }

  // Если еще загружается
  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-1/3">
            <Card className="bg-card border-border text-card-foreground rounded-xl overflow-hidden">
              <div className="relative h-48 bg-gradient-to-r from-blue-900 to-purple-900">
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
                  <div className="relative w-32 h-32 rounded-full border-4 border-card overflow-hidden">
                    {artist.avatarUrl ? (
                      artist.avatarUrl.startsWith('data:') ? (
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image
                          src={artist.avatarUrl}
                          alt={artist.name}
                          fill
                          className="object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-accent flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">{artist.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <CardContent className="pt-20 pb-6">
                <h1 className="text-2xl font-bold text-center text-white mb-2">{artist.name}</h1>
                {artist.email && <p className="text-sm text-center text-gray-400 mb-4">{artist.email}</p>}

                {/* Добавляем ссылки на музыкальные сервисы */}
                <div className="flex justify-center gap-4 mt-4">
                  {artist.vkMusicUrl && (
                    <a
                      href={artist.vkMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Music className="h-4 w-4" />
                      <span>ВК Музыка</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {artist.yandexMusicUrl && (
                    <a
                      href={artist.yandexMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
                    >
                      <Music className="h-4 w-4" />
                      <span>Яндекс Музыка</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {artist.spotifyUrl && (
                    <a
                      href={artist.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition-colors"
                    >
                      <Music className="h-4 w-4" />
                      <span>Spotify</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="w-full md:w-2/3 space-y-6">
            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle>Последние релизы</CardTitle>
              </CardHeader>
              <CardContent>
                {releases.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {releases.slice(0, 4).map((release) => (
                      <Link
                        key={release.id}
                        href={`/dashboard/artist/${params.username}/releases/${release.id}`}
                        className="block"
                      >
                        <div className="bg-accent/30 rounded-lg p-3 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded overflow-hidden">
                              <Image
                                src={release.coverUrl || "/placeholder.svg"}
                                alt={release.title}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">{release.title}</h3>
                              <p className="text-xs text-gray-400">
                                {new Date(release.releaseDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">Нет доступных релизов</p>
                )}

                {releases.length > 4 && (
                  <div className="mt-4 text-center">
                    <Link
                      href={`/dashboard/artist/${params.username}/releases`}
                      className="text-sm text-category-blue hover:text-category-blue/80 transition-colors"
                    >
                      Смотреть все релизы
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle>Плейлисты</CardTitle>
              </CardHeader>
              <CardContent>
                {playlists.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {playlists.slice(0, 4).map((playlist) => (
                      <Link
                        key={playlist.id}
                        href={`/dashboard/artist/${params.username}/playlists/${playlist.id}`}
                        className="block"
                      >
                        <div className="bg-accent/30 rounded-lg p-3 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded overflow-hidden">
                              <Image
                                src={playlist.imageUrl || "/placeholder.svg"}
                                alt={playlist.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">{playlist.name}</h3>
                              <p className="text-xs text-gray-400">{playlist.platform}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">Нет доступных плейлистов</p>
                )}

                {playlists.length > 4 && (
                  <div className="mt-4 text-center">
                    <Link
                      href={`/dashboard/artist/${params.username}/playlists`}
                      className="text-sm text-category-blue hover:text-category-blue/80 transition-colors"
                    >
                      Смотреть все плейлисты
                    </Link>
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
