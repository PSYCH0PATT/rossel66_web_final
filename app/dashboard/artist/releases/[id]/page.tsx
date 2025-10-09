"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Music, Calendar, Barcode, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function ReleaseDetailPage({ params }: { params: { id: string } }) {
  const [release, setRelease] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRelease = async () => {
      try {
        const response = await fetch(`/api/releases/${params.id}`)
        const data = await response.json()
        
        if (data.success) {
          setRelease(data.release)
        }
        setLoading(false)
      } catch (error) {
        console.error('Error fetching release:', error)
        setLoading(false)
      }
    }
    
    fetchRelease()
  }, [params.id])

  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  if (!release) {
    notFound()
  }

  // Status badge colors
  const statusColors = {
    released: "bg-category-green text-black",
    moderation: "bg-category-amber text-black",
    delivery: "bg-category-blue text-black",
    scheduled: "bg-category-purple text-white",
  }

  // Status translations
  const statusLabels = {
    released: "Вышел",
    moderation: "Модерация",
    delivery: "Отгрузка",
    scheduled: "Запланирован",
  }

  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/artist/releases"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад к релизам</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Release Cover and Info */}
          <div className="md:col-span-1">
            <Card className="bg-card border-border text-card-foreground overflow-hidden rounded-xl">
              <div className="aspect-square relative">
                <Image src={release.coverUrl || "/placeholder.svg"} alt={release.title} fill className="object-cover" />
                <Badge className={`absolute top-2 right-2 rounded-xl ${statusColors[release.status]}`}>
                  {statusLabels[release.status]}
                </Badge>
              </div>
              <CardContent className="p-4">
                <h1 className="text-xl font-bold mb-2">{release.title}</h1>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-category-purple" />
                    <span className="text-muted-foreground">UPC: {release.upc}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-category-amber" />
                    <span className="text-muted-foreground">
                      Дата: {new Date(release.releaseDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-category-blue" />
                    <span className="text-muted-foreground">Треков: {release.tracks.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tracks List */}
          <div className="md:col-span-2">
            <Card className="bg-card border-border text-card-foreground rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="h-5 w-5 text-category-blue" />
                  Список треков
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {release.tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-category-blue/20 flex items-center justify-center text-category-blue">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{track.title}</h3>
                          {track.isrc && <p className="text-xs text-muted-foreground">ISRC: {track.isrc}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{track.duration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  )
}
