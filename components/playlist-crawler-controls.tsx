"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RefreshCwIcon as ReloadIcon, CheckCircle } from "lucide-react"

export function PlaylistCrawlerControls() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleStartCrawl = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/playlists/crawl", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: "Парсинг плейлистов инициирован успешно. Проверьте консоль сервера для деталей.",
        })
      } else {
        setResult({
          success: false,
          message: data.error || "Произошла ошибка при запуске парсинга плейлистов.",
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: "Не удалось подключиться к API для парсинга плейлистов.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={handleStartCrawl} disabled={isLoading}>
          {isLoading ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Запуск...
            </>
          ) : (
            "Запустить парсинг плейлистов"
          )}
        </Button>
        <span className="text-sm text-muted-foreground">
          Это запустит процесс парсинга плейлистов для всех артистов с URL ВК Музыки
        </span>
      </div>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTitle>Ошибка</AlertTitle>}
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
