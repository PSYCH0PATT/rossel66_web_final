"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { releases, users } from "@/lib/data"
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

  // Загрузка данных артиста и его релизов
  useEffect(() => {
    // Проверяем статичных артистов
    const staticArtist = users.find((user) => user.id === artistId && user.role === "artist")

    if (staticArtist) {
      setArtist(staticArtist)
      // Получаем релизы артиста из статичных данных
      const artistReleases = releases.filter((release) => release.artistId === artistId)
      setArtistReleases(artistReleases)
      setLoading(false)
      return
    }

    // Проверяем динамически добавленных артистов
    const dynamicUsersStr = localStorage.getItem("dynamicUsers")
    const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []
    const dynamicArtist = dynamicUsers.find((user: any) => user.id === artistId && user.role === "artist")

    if (dynamicArtist) {
      setArtist(dynamicArtist)

      // Получаем релизы артиста из localStorage
      const dynamicReleasesStr = localStorage.getItem(`releases_${artistId}`)
      const dynamicReleases = dynamicReleasesStr ? JSON.parse(dynamicReleasesStr) : []
      setArtistReleases(dynamicReleases)
    } else {
      setError("Артист не найден")
    }

    setLoading(false)
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
      <Layout role="admin" requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  if (error) {
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

          <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </Layout>
    )
  }

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
                      <span className="text-gray-300">Треков: {release.tracks.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Link href={`/admin/artists/${artistId}/releases/${release.id}`}>
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
    </Layout>
  )
}
