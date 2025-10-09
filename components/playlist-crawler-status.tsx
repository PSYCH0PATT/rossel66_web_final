"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { users } from "@/lib/data"
import { CheckCircle, AlertCircle, Clock } from "lucide-react"

export function PlaylistCrawlerStatus() {
  const [artistsWithVkMusic, setArtistsWithVkMusic] = useState<any[]>([])
  const [urlStatus, setUrlStatus] = useState<
    Record<string, { status: "valid" | "invalid" | "checking"; message?: string }>
  >({})

  useEffect(() => {
    // Получаем всех артистов с URL VK Music
    const artistsWithVk = users.filter((user) => user.role === "artist" && user.vkMusicUrl)
    setArtistsWithVkMusic(artistsWithVk)

    // Проверяем статус URL для каждого артиста
    const checkUrls = async () => {
      const statusMap: Record<string, { status: "valid" | "invalid" | "checking"; message?: string }> = {}

      for (const artist of artistsWithVk) {
        if (!artist.vkMusicUrl) continue

        statusMap[artist.id] = { status: "checking" }

        try {
          const response = await fetch(artist.vkMusicUrl, {
            method: "HEAD",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
          })

          if (response.ok) {
            statusMap[artist.id] = { status: "valid", message: "URL доступен" }
          } else {
            statusMap[artist.id] = {
              status: "invalid",
              message: `Ошибка ${response.status}: ${response.statusText}`,
            }
          }
        } catch (error) {
          statusMap[artist.id] = {
            status: "invalid",
            message: `Ошибка при проверке: ${error instanceof Error ? error.message : String(error)}`,
          }
        }
      }

      setUrlStatus(statusMap)
    }

    checkUrls()
  }, [])

  return (
    <Card className="bg-card border-border text-card-foreground">
      <CardHeader>
        <CardTitle>Статус URL артистов в VK Music</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {artistsWithVkMusic.length === 0 ? (
            <p className="text-muted-foreground">Нет артистов с URL VK Music</p>
          ) : (
            <div className="grid gap-3">
              {artistsWithVkMusic.map((artist) => (
                <div key={artist.id} className="flex items-center justify-between p-3 rounded-md bg-accent/30">
                  <div>
                    <p className="font-medium">{artist.name}</p>
                    <a
                      href={artist.vkMusicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      {artist.vkMusicUrl}
                    </a>
                  </div>
                  <div>
                    {!urlStatus[artist.id] ? (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Проверка...
                      </Badge>
                    ) : urlStatus[artist.id].status === "valid" ? (
                      <Badge variant="outline" className="bg-green-500/20 text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Доступен
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/20 text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Недоступен
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
