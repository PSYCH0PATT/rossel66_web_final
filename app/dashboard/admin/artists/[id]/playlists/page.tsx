"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react"
import { users, getArtistPlaylists } from "@/lib/data"
import { VkParserForm } from "@/components/vk-parser-form"
import Image from "next/image"
import Link from "next/link"

export default function ArtistPlaylistsPage({ params }: { params: { id: string } }) {
  const [artist, setArtist] = useState<any>(null)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Находим артиста по ID
    const foundArtist = users.find((user) => user.id === params.id && user.role === "artist")

    if (foundArtist) {
      setArtist(foundArtist)

      // Загружаем плейлисты артиста
      const artistPlaylists = getArtistPlaylists(params.id)
      setPlaylists(artistPlaylists)
    }

    setLoading(false)
  }, [params.id])

  // Функция для удаления плейлиста
  const handleDeletePlaylist = (playlistId: string) => {
    // В реальном приложении здесь был бы код для удаления плейлиста из базы данных
    // Для демонстрации мы просто удалим его из локального состояния

    const updatedPlaylists = playlists.filter((playlist) => playlist.id !== playlistId)
    setPlaylists(updatedPlaylists)

    // Если плейлист был добавлен динамически, удаляем его из localStorage
    try {
      const playlistsStr = localStorage.getItem("playlists")
      if (playlistsStr) {
        const storedPlaylists = JSON.parse(playlistsStr)
        const updatedStoredPlaylists = storedPlaylists.filter((p: any) => p.id !== playlistId)
        localStorage.setItem("playlists", JSON.stringify(updatedStoredPlaylists))
      }
    } catch (error) {
      console.error("Error updating playlists in localStorage:", error)
    }
  }

  // Если артист не найден
  if (!loading && !artist) {
    return (
      <Layout role="admin" requiredRole="admin">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/artists"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Назад к списку артистов</span>
            </Link>
          </div>

          <div className="text-center py-8 text-gray-400">
            <p>Артист не найден</p>
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
            href={`/admin/artists/${params.id}`}
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
                    {playlists.map((playlist) => (
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
                              src={playlist.imageUrl || "/placeholder.svg"}
                              alt={playlist.name}
                              fill
                              className="object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate">{playlist.name}</h3>
                            <p className="text-sm text-gray-400 mb-1">{playlist.platform}</p>
                            <p className="text-xs text-gray-500 mb-2">Добавлен: {playlist.addedDate}</p>

                            {playlist.externalUrl && (
                              <a
                                href={playlist.externalUrl}
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
