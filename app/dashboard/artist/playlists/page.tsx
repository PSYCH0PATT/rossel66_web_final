"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play } from 'lucide-react'
import Image from 'next/image'

interface SftpPlaylist {
  id: number
  playlist_name: string
  playlist_url: string
  playlist_cover_url: string
  platform: string
  tracks_count?: number
  track_position?: number
  parsed_at?: string
  added_at?: string
  tracks_info?: Array<{ title?: string; releaseName?: string }>
}

interface Artist {
  id: string
  name: string
  username: string
}

export default function ArtistPlaylistsPage() {
  const router = useRouter()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [playlists, setPlaylists] = useState<SftpPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [windowWidth, setWindowWidth] = useState(0)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.push('/login')
      return
    }

    const user = JSON.parse(userStr)
    if (user.role !== 'artist' || !user.id) {
      router.push('/login')
      return
    }

    setArtist(user)
    loadPlaylists(user.id)
  }, [router])

  // Отслеживание ширины окна
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    // Установить начальную ширину
    handleResize()
    
    // Добавить слушатель события
    window.addEventListener('resize', handleResize)
    
    // Очистка при размонтировании
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadPlaylists = async (artistId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/playlists/sftp?artistId=${encodeURIComponent(artistId)}`)
      const data = await res.json()
      if (!data.success || !Array.isArray(data.results)) {
        setPlaylists([])
        return
      }
      const list: SftpPlaylist[] = data.results
      const normalizeKey = (p: SftpPlaylist) => {
        const url = (p.playlist_url ?? '').trim().replace(/\/+$/, '')
        const name = (p.playlist_name ?? '').trim().toLowerCase()
        return `${url}|${name}`
      }
      const seen = new Set<string>()
      const unique = list.filter((p) => {
        const key = normalizeKey(p)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      unique.sort((a, b) => {
        const dateA = a.parsed_at || a.added_at || ''
        const dateB = b.parsed_at || b.added_at || ''
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setPlaylists(unique)
    } catch (error) {
      console.error('Ошибка загрузки плейлистов:', error)
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }

  // Определение количества колонок на основе ширины (как в админ панели)
  const getColumnsCount = (width: number) => {
    if (width < 640) return 2   // < sm
    if (width < 768) return 3   // sm
    if (width < 1024) return 4  // md
    if (width < 1280) return 4  // lg
    if (width < 1536) return 5  // xl
    if (width < 1920) return 6  // до 1920px - 6 колонок
    return 8 // >= 1920px - 8 колонок
  }

  const currentColumns = getColumnsCount(windowWidth)

  const getPlatformStyle = (platform: string) => {
    const p = (platform || '').trim()
    if (p === 'VK Музыка') return { bg: '#0077FF', color: '#FFFFFF' }
    if (p === 'Яндекс Музыка') return { bg: '#FFCC00', color: '#000000' }
    if (p === 'МТС Музыка' || p === 'MTS Music') return { bg: '#E30611', color: '#FFFFFF' }
    if (p === 'Сбер Музыка' || p === 'Sber Music') return { bg: '#21A038', color: '#FFFFFF' }
    return { bg: '#6b7280', color: '#FFFFFF' }
  }

  const PlaylistCard = ({ playlist }: { playlist: SftpPlaylist }) => {
    const style = getPlatformStyle(playlist.platform)
    // Как в админке: показываем трек (title), а не альбом (releaseName)
    const trackLabel = playlist.tracks_info?.[0]
      ? `${playlist.tracks_info[0].title || playlist.tracks_info[0].releaseName || ''}`.trim()
      : playlist.tracks_count != null ? `Треков: ${playlist.tracks_count}` : null

    return (
      <Card className="group hover:shadow-lg transition-all duration-200">
        <CardContent className="p-3">
          <div className="flex flex-col space-y-2">
            <a
              href={playlist.playlist_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted block cursor-pointer"
            >
              <Image
                src={playlist.playlist_cover_url || '/placeholder.svg'}
                alt={playlist.playlist_name || ''}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </a>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                {playlist.playlist_name}
              </h3>

              <Badge className="text-xs font-medium border-0" style={{ backgroundColor: style.bg, color: style.color }}>
                {playlist.platform}
              </Badge>

              {trackLabel && (
                <p className="text-xs text-muted-foreground line-clamp-2">{trackLabel}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Layout role="artist">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Мои плейлисты</h1>
            <p className="text-muted-foreground">Загрузка...</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="artist">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Мои плейлисты
          </h1>
          <p className="text-muted-foreground">
            Все плейлисты, в которых есть ваши треки
          </p>
        </div>

        {playlists.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                Пока нет плейлистов с вашими треками
              </p>
              <p className="text-sm text-muted-foreground">
                Плейлисты подгружаются из отчётов SFTP после синхронизации
              </p>
            </CardContent>
          </Card>
        ) : (
          <div 
            className="grid gap-3" 
            style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
          >
            {playlists.map((playlist) => (
              <PlaylistCard key={`${playlist.playlist_url ?? ''}-${playlist.playlist_name ?? ''}-${playlist.id}`} playlist={playlist} />
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Всего найдено: {playlists.length} {playlists.length === 1 ? 'плейлист' : playlists.length < 5 ? 'плейлиста' : 'плейлистов'}
        </div>
      </div>
    </Layout>
  )
}
