"use client"

import { useState, useEffect } from "react"
import Layout from "@/components/layout"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Image from "next/image"
// fetch users from API instead of stale lib/data
import { Music, Calendar } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

interface Release {
  id: string
  artistId: string
  artistName: string
  title: string
  coverUrl: string
  upc: string
  releaseDate: string
  status: 'released' | 'moderation' | 'delivery' | 'scheduled'
  tracks: any[]
}

export default function ReleasesPage({ params }: { params: { username: string } }) {
  const [artistId, setArtistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoadingReleases, setIsLoadingReleases] = useState(true)
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Определяем artistId по username из API (без учета регистра)
  useEffect(() => {
    const fetchArtist = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (data?.success && Array.isArray(data.users)) {
          setAllUsers(data.users)
          const uname = String(params.username).toLowerCase()
          const artist = data.users.find((u: any) => u.role === 'artist' && String(u.username).toLowerCase() === uname)
          if (artist) {
            setArtistId(artist.id)
          }
        }
      } catch (e) {
        console.error('Failed to load users for artist match', e)
      } finally {
        setLoading(false)
      }
    }
    fetchArtist()
  }, [params.username])

  // Загружаем релизы и фильтруем по artistId из базы данных, включая фиты
  useEffect(() => {
    const fetchReleases = async () => {
      if (!artistId) return
      setIsLoadingReleases(true)
      try {
        const response = await fetch('/api/releases')
        const result = await response.json()
        if (result?.success && Array.isArray(result.releases)) {
          const ownRaw = result.releases.filter((r: any) => {
            const direct = r.artistId === artistId ||
              String(r.artistId).replace('artist', 'user_') === artistId ||
              String(r.artistId).replace('user_', 'artist') === artistId
            if (direct) return true
            // проверка фитов на уровне треков
            if (Array.isArray(r.tracks)) {
              for (const t of r.tracks) {
                if (Array.isArray(t?.featuredArtistIds) && t.featuredArtistIds.includes(artistId)) {
                  return true
                }
              }
            }
            return false
          })
          // добавим отображаемые имена артистов (главный + фиты)
          const own = ownRaw.map((release: any) => {
            const main = allUsers.find(u => u.id === release.artistId)?.name || release.artistName || 'Неизвестный артист'
            const featuredSet = new Set<string>()
            if (Array.isArray(release.tracks)) {
              for (const t of release.tracks) {
                if (Array.isArray(t?.featuredArtistIds)) {
                  for (const fid of t.featuredArtistIds) featuredSet.add(String(fid))
                }
                if (Array.isArray(t?.featuredArtistNames)) {
                  for (const nm of t.featuredArtistNames) featuredSet.add(String(nm))
                }
              }
            }
            const featuredList: string[] = []
            for (const val of featuredSet) {
              const byId = allUsers.find(u => u.id === val)?.name
              if (byId) featuredList.push(byId)
              else if (!val.startsWith('user_') && !val.startsWith('artist')) featuredList.push(val)
            }
            return { ...release, artistDisplay: featuredList.length ? `${main}, ${featuredList.join(', ')}` : main }
          })
          console.log(`Загружено релизов для артиста ${artistId}:`, own.length)
          setReleases(own)
        } else {
          setReleases([])
        }
      } catch (error) {
        console.error('Ошибка при загрузке релизов:', error)
        setReleases([])
      } finally {
        setIsLoadingReleases(false)
      }
    }
    fetchReleases()
  }, [artistId, allUsers])

  if (!loading && !artistId) {
    notFound()
  }

  if (loading || !artistId) {
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Релизы ({releases.length})</h1>
        </div>

        {isLoadingReleases ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
          </div>
        ) : releases.length === 0 ? (
          <div className="bg-transparent border border-slate-600/30 rounded-xl p-8 text-center text-white">
            <h2 className="text-xl font-semibold mb-2">Нет релизов</h2>
            <p className="text-slate-400 mb-0">После публикации релизы появятся здесь.</p>
          </div>
        ) : (
          <div className="bg-transparent border border-slate-600/30 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-600/30 hover:bg-slate-700/20">
                  <TableHead className="text-slate-300">Обложка</TableHead>
                  <TableHead className="text-slate-300">Название</TableHead>
                  <TableHead className="text-slate-300">Исполнители</TableHead>
                  <TableHead className="text-slate-300">UPC</TableHead>
                  <TableHead className="text-slate-300">Дата релиза</TableHead>
                  <TableHead className="text-slate-300">Треков</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((release) => (
                  <TableRow key={release.id} className="border-slate-600/30 hover:bg-slate-700/20">
                    <TableCell>
                      <div className="w-12 h-12 relative rounded-lg overflow-hidden">
                        <Image 
                          src={release.coverUrl || "/placeholder.svg"} 
                          alt={release.title} 
                          fill 
                          className="object-cover" 
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-white max-w-[220px]">
                      <Link href={`/dashboard/artist/${params.username}/releases/${release.id}`} className="truncate block" title={release.title}>
                        {release.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-300">{(release as any).artistDisplay || ''}</TableCell>
                    <TableCell className="text-slate-400 font-mono text-sm">{release.upc}</TableCell>
                    <TableCell className="text-slate-300">{new Date(release.releaseDate).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-1">
                        <Music className="h-4 w-4 text-green-400" />
                        {release.tracks.length}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  )
}
