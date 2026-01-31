"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Play } from 'lucide-react'
import Image from 'next/image'

interface VKPlaylist {
  id: number
  artist_url: string
  artist_name: string
  playlist_name: string
  playlist_url: string
  playlist_cover_url: string
  playlist_id: string
  owner_id: string
  parsed_at: string
}

interface BandlinkPlaylist {
  id: number
  artist_name: string
  playlist_name: string
  playlist_artist: string
  track_names: string
  likes_count: string
  platform: string
  playlist_cover_url: string
  playlist_url: string
  parsed_at: string
}

interface Artist {
  id: string
  name: string
  username: string
}

type Playlist = (VKPlaylist | BandlinkPlaylist) & { type: 'vk' | 'bandlink' }

export default function ArtistPlaylistsPage() {
  const router = useRouter()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [windowWidth, setWindowWidth] = useState(0)

  useEffect(() => {
    // Получаем текущего пользователя из localStorage
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.push('/login')
      return
    }

    const user = JSON.parse(userStr)
    if (user.role !== 'artist') {
      router.push('/login')
      return
    }

    setArtist(user)
    loadPlaylists(user.name)
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

  const loadPlaylists = async (artistName: string) => {
    try {
      setLoading(true)
      
      // Загружаем VK плейлисты
      const vkResponse = await fetch('/api/parsers/vk')
      const vkData = await vkResponse.json()
      
      // Загружаем Bandlink плейлисты
      const bandlinkResponse = await fetch('/api/parsers/bandlink')
      const bandlinkData = await bandlinkResponse.json()
      
      // Фильтруем по имени артиста
      const vkPlaylists = (vkData.results || [])
        .filter((p: VKPlaylist) => p.artist_name === artistName)
        .map((p: VKPlaylist) => ({ ...p, type: 'vk' as const }))
      
      const bandlinkPlaylists = (bandlinkData.results || [])
        .filter((p: BandlinkPlaylist) => p.artist_name === artistName)
        .map((p: BandlinkPlaylist) => ({ ...p, type: 'bandlink' as const }))
      
      // Объединяем и сортируем по дате
      const allPlaylists = [...vkPlaylists, ...bandlinkPlaylists].sort((a, b) => {
        return new Date(b.parsed_at).getTime() - new Date(a.parsed_at).getTime()
      })
      
      setPlaylists(allPlaylists)
    } catch (error) {
      console.error('Ошибка загрузки плейлистов:', error)
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

  const PlaylistCard = ({ playlist }: { playlist: Playlist }) => {
    const isVK = playlist.type === 'vk'
    const vkPlaylist = playlist as VKPlaylist
    const bandlinkPlaylist = playlist as BandlinkPlaylist

    return (
      <Card className="group hover:shadow-lg transition-all duration-200">
        <CardContent className="p-3">
          <div className="flex flex-col space-y-2">
            {/* Обложка - кликабельная */}
            <a
              href={isVK ? vkPlaylist.playlist_url : bandlinkPlaylist.playlist_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted block cursor-pointer"
            >
              <Image
                src={isVK ? (vkPlaylist.playlist_cover_url || "/placeholder.svg") : (bandlinkPlaylist.playlist_cover_url || "/placeholder.svg")}
                alt={isVK ? vkPlaylist.playlist_name : bandlinkPlaylist.playlist_name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </a>

            {/* Информация о плейлисте */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                {isVK ? vkPlaylist.playlist_name : bandlinkPlaylist.playlist_name}
              </h3>
              
              <Badge 
                className="text-xs font-medium border-0"
                style={{
                  backgroundColor: isVK 
                    ? "#0077FF" 
                    : bandlinkPlaylist.platform === "Яндекс Музыка" 
                      ? "#FFCC00" 
                      : "#E30611",
                  color: isVK 
                    ? "#FFFFFF" 
                    : bandlinkPlaylist.platform === "Яндекс Музыка" 
                      ? "#000000" 
                      : "#FFFFFF"
                }}
              >
                {isVK ? "VK Музыка" : bandlinkPlaylist.platform}
              </Badge>

              {!isVK && bandlinkPlaylist.track_names && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {bandlinkPlaylist.track_names}
                </p>
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
                Плейлисты появятся после парсинга администратором
              </p>
            </CardContent>
          </Card>
        ) : (
          <div 
            className="grid gap-3" 
            style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
          >
            {playlists.map((playlist, index) => (
              <PlaylistCard key={`${playlist.type}-${playlist.id}`} playlist={playlist} />
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
