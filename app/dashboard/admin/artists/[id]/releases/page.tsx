"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Music, Calendar, Barcode, Plus, Edit, Trash, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function ArtistReleasesPage({ params }: { params: { id: string } }) {
  const artistId = params.id
  const [artist, setArtist] = useState<any>(null)
  const [artistReleases, setArtistReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const fetchArtistAndReleases = async () => {
      try {
        const artistsRes = await fetch(
          `/api/artists?id=${encodeURIComponent(artistId)}`
        )
        const artistsData = await artistsRes.json()
        if (!artistsData.success || cancelled) return

        const foundArtist = artistsData.artists?.[0]
        if (!foundArtist) {
          setError("Артист не найден")
          return
        }

        setArtist(foundArtist)

        const releasesRes = await fetch(`/api/releases/artist/${artistId}`)
        const releasesData = await releasesRes.json()
        if (cancelled) return
        if (releasesData.success && Array.isArray(releasesData.releases)) {
          setArtistReleases(releasesData.releases)
        } else {
          setArtistReleases([])
        }
      } catch (e) {
        if (!cancelled) {
          setError("Ошибка загрузки данных")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchArtistAndReleases()
    return () => { cancelled = true }
  }, [artistId])

  // Status badge colors
  const statusColors = {
    released: "bg-emerald text-black",
    moderation: "bg-amber-500 text-black",
    delivery: "bg-azure text-black",
    scheduled: "bg-purple-500 text-white",
  }

  // Status translations
  const statusLabels = {
    released: "Вышел",
    moderation: "Модерация",
    delivery: "Отгрузка",
    scheduled: "Запланирован",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )
  }

  if (error) {
    return (
      
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

          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )
  }

  return (
    
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

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Релизы артиста: {artist?.name}</h1>

          <Button className="bg-azure hover:bg-azure-dark text-black">
            <Plus className="h-4 w-4 mr-2" />
            Добавить релиз
          </Button>
        </div>

        {artistReleases.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <Music className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">Нет релизов</h2>
            <p className="text-gray-400 mb-6">У этого артиста пока нет релизов</p>
            <Button className="bg-azure hover:bg-azure-dark text-black">
              <Plus className="h-4 w-4 mr-2" />
              Добавить первый релиз
            </Button>
          </div>
        ) : (
          <div className="releases-grid">
            {artistReleases.map((release) => (
              <Card key={release.id} className="bg-gray-900 border-gray-800 text-white overflow-hidden">
                <div className="aspect-square relative">
                  <Image
                    src={release.coverUrl || "/placeholder.svg"}
                    alt={release.title}
                    fill
                    className="object-cover"
                  />
                  <Badge
                    className={`absolute top-2 right-2 ${statusColors[release.status as keyof typeof statusColors]}`}
                  >
                    {statusLabels[release.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h2 className="text-lg font-bold mb-1">{release.title}</h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Barcode className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">UPC: {release.upc}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Дата: {new Date(release.releaseDate).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Треков: {release.tracks?.length ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Link href={`/dashboard/admin/artists/${artistId}/releases/${release.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-azure text-azure hover:bg-azure hover:text-black"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                    >
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Удалить</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
}
