"use client"

import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { getArtistReleases } from "@/lib/data"
import { Music, Calendar, Barcode } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function ReleasesPage() {
  // В реальном приложении ID артиста будет получен из сессии
  const artistId = "1" // Это нужно будет заменить на получение ID из сессии
  const [releases, setReleases] = useState(getArtistReleases(artistId))

  useEffect(() => {
    // Обновляем релизы при изменении localStorage
    const handleStorageChange = () => {
      setReleases(getArtistReleases(artistId))
    }

    // Слушаем изменения в localStorage
    window.addEventListener('storage', handleStorageChange)
    
    // Также проверяем при монтировании компонента
    handleStorageChange()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [artistId])

  // Цвета для статусов релизов - соответствуют админской панели
  const statusColors: Record<string, string> = {
    // Стандартные статусы
    "Модерируется": "bg-orange-500 hover:bg-orange-600 text-white",
    "Отклонен": "bg-red-500 hover:bg-red-600 text-white",
    "В доставке": "bg-purple-500 hover:bg-purple-600 text-white",
    "Доставлен": "bg-green-500 hover:bg-green-600 text-white",
    // Legacy статусы для обратной совместимости
    "На модерации": "bg-orange-500 hover:bg-orange-600 text-white",
    "Одобрен": "bg-blue-500 hover:bg-blue-600 text-white",
    "Отклонён": "bg-red-500 hover:bg-red-600 text-white",
    "Снят": "bg-gray-500 hover:bg-gray-600 text-white",
    released: "bg-green-500 hover:bg-green-600 text-white",
    moderation: "bg-orange-500 hover:bg-orange-600 text-white",
    delivery: "bg-blue-500 hover:bg-blue-600 text-white",
    scheduled: "bg-purple-500 hover:bg-purple-600 text-white",
  }

  // Переводы статусов - соответствуют админской панели
  const statusLabels: Record<string, string> = {
    // Стандартные статусы
    "Модерируется": "Модерируется",
    "Отклонен": "Отклонен",
    "В доставке": "В доставке",
    "Доставлен": "Доставлен",
    // Legacy статусы для обратной совместимости
    "На модерации": "Модерируется",
    "Одобрен": "Доставлен",
    "Отклонён": "Отклонен",
    "Снят": "Отклонен",
    released: "Доставлен",
    moderation: "Модерируется",
    delivery: "В доставке",
    scheduled: "Модерируется",
  }

  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Релизы</h1>
        </div>

        {releases.length > 0 ? (
          <div className="releases-grid">
            {releases.map((release) => (
              <Link href={`/dashboard/artist/releases/${release.id}`} key={release.id}>
                <Card className="bg-card border-border text-card-foreground overflow-hidden rounded-xl hover:border-category-blue/50 transition-colors cursor-pointer">
                  <div className="aspect-square relative">
                    <Image
                      src={release.coverUrl || "/placeholder.svg"}
                      alt={release.title}
                      fill
                      className="object-cover"
                    />
                    <Badge className={`absolute top-1 right-1 sm:top-2 sm:right-2 rounded-xl text-xs ${statusColors[release.status || 'Доставлен'] || 'bg-gray-500 text-white'}`}>
                      {statusLabels[release.status || 'Доставлен'] || release.status || 'Доставлен'}
                    </Badge>
                    {release.tracks.length > 1 && (
                      <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/70 text-white text-xs px-1 sm:px-2 py-1 rounded-lg flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        {release.tracks.length}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h2 className="text-base font-bold mb-2 line-clamp-1">{release.title}</h2>

                    <div className="space-y-2 text-sm">
                      {release.upc && (
                        <div className="flex items-center gap-2">
                          <Barcode className="h-4 w-4 text-category-purple" />
                          <span className="text-muted-foreground line-clamp-1">UPC: {release.upc}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-category-amber" />
                        <span className="text-muted-foreground">
                          {new Date(release.releaseDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-card border-border text-card-foreground rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">У вас пока нет релизов</h2>
            <p className="text-muted-foreground">
              Здесь будут отображаться ваши релизы после их создания и загрузки в систему.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
