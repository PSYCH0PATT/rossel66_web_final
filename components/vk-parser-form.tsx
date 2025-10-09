"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check, Loader2 } from "lucide-react"

interface VkParserFormProps {
  artistId: string
  artistName: string
}

export function VkParserForm({ artistId, artistName }: VkParserFormProps) {
  const [html, setHtml] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [parsedPlaylists, setParsedPlaylists] = useState<any[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!html.trim()) {
      setError("Пожалуйста, вставьте HTML-код страницы")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    setParsedPlaylists([])

    try {
      const response = await fetch("/api/vk-parser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ html, artistId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка при парсинге страницы")
      }

      if (data.playlists && data.playlists.length > 0) {
        setSuccess(`Успешно добавлено ${data.playlists.length} плейлистов для артиста ${artistName}`)
        setParsedPlaylists(data.playlists)
      } else {
        setSuccess("Плейлисты не найдены на странице")
      }
    } catch (err: any) {
      setError(err.message || "Произошла ошибка при парсинге страницы")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-card border-border text-card-foreground rounded-xl">
      <CardHeader>
        <CardTitle>Парсинг плейлистов из ВК Музыки</CardTitle>
        <CardDescription>Вставьте HTML-код страницы артиста из ВК Музыки для извлечения плейлистов</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Вставьте HTML-код страницы артиста из ВК Музыки..."
            className="h-64 bg-accent/50 border-gray-700 text-white"
            disabled={loading}
          />

          {error && (
            <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-emerald/20 border-emerald/50 text-white">
              <Check className="h-4 w-4 text-emerald" />
              <AlertTitle>Успешно</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {parsedPlaylists.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Найденные плейлисты:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parsedPlaylists.map((playlist, index) => (
                  <div key={index} className="bg-accent/30 p-2 rounded-md flex items-center gap-2">
                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={playlist.imageUrl || "/placeholder.svg"}
                        alt={playlist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{playlist.name}</p>
                      <a
                        href={playlist.playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                      >
                        {playlist.playlistUrl}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button
          type="submit"
          onClick={handleSubmit}
          className="bg-category-blue hover:bg-category-blue/80 text-black"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Парсинг...
            </>
          ) : (
            "Извлечь плейлисты"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
