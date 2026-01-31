"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Music, Calendar, Barcode, Clock, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default function ArtistReleaseDetailPage({ params }: { params: { username: string; id: string } }) {
  const [release, setRelease] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [artist, setArtist] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Находим артиста по username
        const usersResponse = await fetch('/api/users')
        const usersData = await usersResponse.json()
        
        if (!usersData.success) {
          setLoading(false)
          return
        }
        
        const foundArtist = usersData.users.find((user: any) => user.username === params.username && user.role === "artist")
        
        if (!foundArtist) {
          setLoading(false)
          return
        }
        
        setArtist(foundArtist)

        // Находим релиз
        const releaseResponse = await fetch(`/api/releases/${params.id}`)
        const releaseData = await releaseResponse.json()
        
        if (!releaseData.success || releaseData.release.artistId !== foundArtist.id) {
          setLoading(false)
          return
        }
        
        setRelease(releaseData.release)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }
    
    fetchData()
  }, [params.username, params.id])

  if (loading) {
    return (
      <Layout role="artist" requiredRole="artist" username={params.username}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </Layout>
    )
  }

  if (!artist || !release) {
    notFound()
  }

  return (
    <Layout role="artist" requiredRole="artist" username={params.username}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/artist/${params.username}/releases`}
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
              </div>
              <CardContent className="p-4">
                <h1 className="text-xl font-bold mb-2">{release.title}</h1>
                
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800 rounded-lg">
                  <Music className="h-4 w-4 text-azure" />
                  <span className="text-sm text-gray-300">{artist.name}</span>
                </div>

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
                  {release.tracks.map((track: any, index: number) => (
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

        {/* Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border text-card-foreground">
            <CardHeader>
              <CardTitle className="text-lg">Техническая информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">ID релиза</p>
                <p className="font-mono text-sm">{release.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">UPC код</p>
                <p className="font-mono text-sm">{release.upc}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата релиза</p>
                <p className="text-sm">{new Date(release.releaseDate).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border text-card-foreground">
            <CardHeader>
              <CardTitle className="text-lg">Статистика</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Общее количество треков</p>
                <p className="text-2xl font-bold text-azure">{release.tracks.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Треки с ISRC</p>
                <p className="text-2xl font-bold text-emerald">
                  {release.tracks.filter((track: any) => track.isrc).length}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Общая длительность</p>
                <p className="text-lg font-medium">
                  {release.tracks.reduce((total: number, track: any) => {
                    const [minutes, seconds] = track.duration.split(':').map(Number)
                    return total + minutes * 60 + seconds
                  }, 0)} сек
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}