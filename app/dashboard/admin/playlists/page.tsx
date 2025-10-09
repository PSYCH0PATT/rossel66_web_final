"use client"

import { useState, useEffect } from 'react'
import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Music, Trash2, RefreshCw, Search, Users, Clock, Settings } from 'lucide-react'
import Image from 'next/image'

interface Artist {
  id: string
  name: string
  username: string
}

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

export default function PlaylistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [recentArtists, setRecentArtists] = useState<Artist[]>([])
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [vkResults, setVkResults] = useState<VKPlaylist[]>([])
  const [bandlinkResults, setBandlinkResults] = useState<BandlinkPlaylist[]>([])
  const [isParsingVK, setIsParsingVK] = useState(false)
  const [isParsingBandlink, setIsParsingBandlink] = useState(false)
  const [parsingOutput, setParsingOutput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all')
  const [windowWidth, setWindowWidth] = useState(0)

  useEffect(() => {
    loadArtists()
    loadRecentArtists()
    loadResults()
  }, [])

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

  const loadArtists = async () => {
    try {
      const response = await fetch('/api/artists')
      const data = await response.json()
      if (data.success) {
        setArtists(data.artists)
      }
    } catch (error) {
      console.error('Ошибка загрузки артистов:', error)
    }
  }

  const loadRecentArtists = async () => {
    try {
      const response = await fetch('/api/parsers/recent-artists')
      const data = await response.json()
      if (data.success) {
        setRecentArtists(data.artists)
      }
    } catch (error) {
      console.error('Ошибка загрузки недавних артистов:', error)
    }
  }

  const loadResults = async () => {
    try {
      const [vkResponse, bandlinkResponse] = await Promise.all([
        fetch('/api/parsers/vk'),
        fetch('/api/parsers/bandlink')
      ])
      
      const vkData = await vkResponse.json()
      const bandlinkData = await bandlinkResponse.json()
      
      if (vkData.success) {
        setVkResults(vkData.results || [])
      }
      if (bandlinkData.success) {
        setBandlinkResults(bandlinkData.results || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки результатов парсинга:', error)
    }
  }

  const clearResults = async () => {
    if (confirm('Очистить все результаты парсинга из базы данных?')) {
      try {
        const response = await fetch('/api/parsers/clear', {
          method: 'DELETE'
        })
        
        const data = await response.json()
        
        if (data.success) {
          setVkResults([])
          setBandlinkResults([])
          setParsingOutput(prev => prev + '\n✅ Все результаты парсинга очищены\n')
        } else {
          alert('Ошибка очистки: ' + data.error)
        }
      } catch (error) {
        console.error('Ошибка очистки результатов:', error)
        alert('Ошибка очистки результатов')
      }
    }
  }

  const handleArtistSelect = (artistId: string, checked: boolean) => {
    if (checked) {
      setSelectedArtists(prev => [...prev, artistId])
    } else {
      setSelectedArtists(prev => prev.filter(id => id !== artistId))
    }
  }

  const selectAllRecentArtists = () => {
    const recentArtistUsernames = recentArtists.map(artist => artist.username)
    setSelectedArtists(recentArtistUsernames)
  }

  const clearSelection = () => {
    setSelectedArtists([])
  }

  const runVKParser = async () => {
    if (selectedArtists.length === 0) {
      alert('Выберите артистов для парсинга')
      return
    }

    setIsParsingVK(true)
    setParsingOutput('Запуск VK парсера...\n')

    try {
      const response = await fetch('/api/parsers/vk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artists: selectedArtists
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setParsingOutput(prev => prev + '\n✅ VK парсинг завершен успешно!\n')
        setParsingOutput(prev => prev + data.output + '\n')
        setVkResults(data.results || [])
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка VK парсинга: ' + data.error + '\n')
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n')
        }
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n')
    } finally {
      setIsParsingVK(false)
    }
  }

  const runBandlinkParser = async () => {
    if (selectedArtists.length === 0) {
      alert('Выберите артистов для парсинга')
      return
    }

    setIsParsingBandlink(true)
    setParsingOutput('Запуск Bandlink парсера...\n')

    try {
      // Преобразуем selectedArtists (которые могут быть username/id) в имена артистов
      const artistNames = selectedArtists.map(selectedId => {
        const artist = artists.find(a => a.username === selectedId || a.id === selectedId)
        return artist ? artist.name : selectedId
      })

      const response = await fetch('/api/parsers/bandlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artists: artistNames
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setParsingOutput(prev => prev + '\n✅ Bandlink парсинг завершен успешно!\n')
        setParsingOutput(prev => prev + data.output + '\n')
        setBandlinkResults(data.results || [])
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка Bandlink парсинга: ' + data.error + '\n')
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n')
        }
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n')
    } finally {
      setIsParsingBandlink(false)
    }
  }

  // Фильтрация артистов
  const filteredArtists = artists.filter(artist => 
    artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artist.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Фильтрация плейлистов по артисту
  const filterPlaylistsByArtist = (playlists: any[], artistFilter: string) => {
    if (artistFilter === 'all') return playlists
    return playlists.filter(playlist => 
      playlist.artist_name === artistFilter || playlist.artist_name?.includes(artistFilter)
    )
  }

  // Группировка плейлистов по платформам
  const vkPlaylists = filterPlaylistsByArtist(vkResults, selectedArtistFilter)
  const yandexPlaylists = filterPlaylistsByArtist(
    bandlinkResults.filter(p => p.platform === 'Яндекс Музыка'), 
    selectedArtistFilter
  )
  const mtsPlaylists = filterPlaylistsByArtist(
    bandlinkResults.filter(p => p.platform === 'МТС Музыка'), 
    selectedArtistFilter
  )

  // Получение уникальных артистов из результатов
  const getUniqueArtists = () => {
    const artistsSet = new Set<string>()
    vkResults.forEach(p => artistsSet.add(p.artist_name))
    bandlinkResults.forEach(p => artistsSet.add(p.artist_name))
    return Array.from(artistsSet).sort()
  }

  // Определение количества колонок на основе ширины
  const getColumnsCount = (width: number) => {
    if (width < 640) return 2   // < sm
    if (width < 768) return 3   // sm
    if (width < 1024) return 4  // md
    if (width < 1280) return 4  // lg (изменено с 5 на 4)
    if (width < 1536) return 5  // xl (изменено с 6 на 5)
    if (width < 1920) return 6  // до 1920px - 6 колонок
    return 8 // >= 1920px - 8 колонок
  }

  const currentColumns = getColumnsCount(windowWidth)

  const deletePlaylist = async (id: number, type: 'vk' | 'bandlink') => {
    if (!confirm('Вы уверены, что хотите удалить этот плейлист?')) {
      return
    }

    try {
      const response = await fetch('/api/parsers/delete-playlist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, type }),
      })

      const data = await response.json()
      
      if (data.success) {
        // Обновляем список
        loadResults()
      } else {
        alert('Ошибка удаления: ' + data.error)
      }
    } catch (error) {
      console.error('Ошибка удаления плейлиста:', error)
      alert('Ошибка удаления плейлиста')
    }
  }

  const PlaylistCard = ({ playlist, type }: { playlist: VKPlaylist | BandlinkPlaylist, type: 'vk' | 'bandlink' }) => {
    const isVK = type === 'vk'
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
                src={isVK ? vkPlaylist.playlist_cover_url : bandlinkPlaylist.playlist_cover_url}
                alt={isVK ? vkPlaylist.playlist_name : bandlinkPlaylist.playlist_name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <Play className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              {/* Кнопка удаления */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  deletePlaylist(playlist.id, type)
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                title="Удалить плейлист"
              >
                <Trash2 className="w-3 h-3" />
              </button>
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
                {isVK ? "VK" : bandlinkPlaylist.platform}
              </Badge>

              <p className="text-xs text-muted-foreground line-clamp-1 font-medium">
                {isVK ? vkPlaylist.artist_name : bandlinkPlaylist.artist_name}
              </p>

              {/* Названия треков для Bandlink */}
              {!isVK && bandlinkPlaylist.track_names && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Треки:</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {bandlinkPlaylist.track_names}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Layout role="admin">
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Плейлисты</h1>
            <p className="text-muted-foreground">
              Управление плейлистами из VK, МТС Музыки и Яндекс Музыки
            </p>
            </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <Music className="w-3 h-3" />
              {vkResults.length + bandlinkResults.length} плейлистов
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="playlists" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="playlists" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              По платформам
            </TabsTrigger>
            <TabsTrigger value="by-artists" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              По артистам
            </TabsTrigger>
            <TabsTrigger value="parsing" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Парсинг
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-6">
            {/* Фильтр по артистам */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium">Фильтр по артисту:</span>
                  </div>
                  <Select value={selectedArtistFilter} onValueChange={setSelectedArtistFilter}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Все артисты" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все артисты</SelectItem>
                      {getUniqueArtists().map(artist => (
                        <SelectItem key={artist} value={artist}>{artist}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground">
                    Показано: {vkPlaylists.length + yandexPlaylists.length + mtsPlaylists.length} плейлистов
                  </div>
                </div>
            </CardContent>
          </Card>

            {/* VK Музыка */}
            {vkPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="https://appteka.store/get/e2Up17I-CKFD00SOu6guqRlr1xf2VWKt00nKbMpxN0mWU6Sbz-H2_KDnRivvKElyWyBcGKvocgGS-b70rVdkR4kU-I4=/6eaef668d24126abac8a69524492af8e349e4920.png" 
                      alt="VK Music" 
                      className="w-5 h-5"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white">VK Музыка</h2>
                  <Badge 
                    className="border-0"
                    style={{ backgroundColor: "#0077FF", color: "#FFFFFF" }}
                  >
                    {vkPlaylists.length}
                  </Badge>
                      </div>

                <div 
                  className="grid gap-3" 
                  style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                >
                  {vkPlaylists.map((playlist) => (
                    <PlaylistCard key={`vk-${playlist.id}`} playlist={playlist} type="vk" />
                  ))}
                </div>
              </div>
            )}

            {/* Яндекс Музыка */}
            {yandexPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="https://yastatic.net/s3/bandlink/bandlink-external-pages/1.250.0/_next/static/media/yandex-music.6fa872a7.svg" 
                      alt="Yandex Music" 
                      className="w-7 h-7"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Яндекс Музыка</h2>
                  <Badge 
                    className="border-0"
                    style={{ backgroundColor: "#FFCC00", color: "#000000" }}
                  >
                    {yandexPlaylists.length}
                  </Badge>
                        </div>

                <div 
                  className="grid gap-3" 
                  style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                >
                  {yandexPlaylists.map((playlist) => (
                    <PlaylistCard key={`yandex-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                </div>
              </div>
            )}

            {/* МТС Музыка */}
            {mtsPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="https://yastatic.net/s3/bandlink/bandlink-external-pages/1.250.0/_next/static/media/mts-music.d8720374.svg" 
                      alt="MTS Music" 
                      className="w-7 h-7"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white">МТС Музыка</h2>
                  <Badge 
                    className="border-0"
                    style={{ backgroundColor: "#E30611", color: "#FFFFFF" }}
                  >
                    {mtsPlaylists.length}
                  </Badge>
                </div>
                
                <div 
                  className="grid gap-3" 
                  style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                >
                  {mtsPlaylists.map((playlist) => (
                    <PlaylistCard key={`mts-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                          </div>
                        </div>
            )}

            {/* Пустое состояние */}
            {vkPlaylists.length === 0 && yandexPlaylists.length === 0 && mtsPlaylists.length === 0 && (
              <Card className="border-2 border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="bg-muted rounded-full p-6 mb-6">
                    <Music className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Нет плейлистов</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    {selectedArtistFilter === 'all' 
                      ? 'Запустите парсинг для получения плейлистов'
                      : `Нет плейлистов для артиста "${selectedArtistFilter}"`
                    }
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const tab = document.querySelector('[value="parsing"]') as HTMLElement
                      tab?.click()
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Перейти к парсингу
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="by-artists" className="space-y-6">
            {/* Группировка плейлистов по артистам */}
            {getUniqueArtists().map(artistName => {
              const artist = artists.find(a => a.name === artistName)
              const artistVKPlaylists = vkResults.filter(p => p.artist_name === artistName)
              const artistBandlinkPlaylists = bandlinkResults.filter(p => p.artist_name === artistName)
              const totalPlaylists = artistVKPlaylists.length + artistBandlinkPlaylists.length

              if (totalPlaylists === 0) return null

              return (
                <div key={artistName} className="space-y-4">
                  {/* Заголовок артиста */}
                  <div className="flex items-center gap-4 bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center text-2xl font-bold text-primary">
                      {artist?.name?.charAt(0) || artistName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">{artistName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {totalPlaylists} {totalPlaylists === 1 ? 'плейлист' : totalPlaylists < 5 ? 'плейлиста' : 'плейлистов'}
                      </p>
                      </div>
                    <div className="flex gap-2">
                      {artistVKPlaylists.length > 0 && (
                        <Badge style={{ backgroundColor: "#0077FF", color: "#FFFFFF" }}>
                          VK: {artistVKPlaylists.length}
                        </Badge>
                      )}
                      {artistBandlinkPlaylists.filter(p => p.platform === 'Яндекс Музыка').length > 0 && (
                        <Badge style={{ backgroundColor: "#FFCC00", color: "#000000" }}>
                          Яндекс: {artistBandlinkPlaylists.filter(p => p.platform === 'Яндекс Музыка').length}
                        </Badge>
                      )}
                      {artistBandlinkPlaylists.filter(p => p.platform === 'МТС Музыка').length > 0 && (
                        <Badge style={{ backgroundColor: "#E30611", color: "#FFFFFF" }}>
                          МТС: {artistBandlinkPlaylists.filter(p => p.platform === 'МТС Музыка').length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Плейлисты артиста */}
                  <div 
                    className="grid gap-3" 
                    style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                  >
                    {artistVKPlaylists.map((playlist) => (
                      <PlaylistCard key={`vk-${playlist.id}`} playlist={playlist} type="vk" />
                    ))}
                    {artistBandlinkPlaylists.map((playlist) => (
                      <PlaylistCard key={`bandlink-${playlist.id}`} playlist={playlist} type="bandlink" />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Пустое состояние */}
            {getUniqueArtists().length === 0 && (
              <Card className="border-2 border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="bg-muted rounded-full p-6 mb-6">
                    <Users className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Нет артистов</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md">
                    Запустите парсинг для получения плейлистов
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const tab = document.querySelector('[value="parsing"]') as HTMLElement
                      tab?.click()
                    }}
                    className="flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Перейти к парсингу
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="parsing" className="space-y-6">
            {/* Панель управления парсингом */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Поиск и выбор артистов */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Выбор артистов</h3>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск артистов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllRecentArtists}
                  disabled={recentArtists.length === 0}
                  className="flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  Недавние ({recentArtists.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearSelection}
                  disabled={selectedArtists.length === 0}
                >
                  Очистить
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto bg-background/50 rounded-lg p-3 border">
                {filteredArtists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {searchTerm ? 'Артисты не найдены' : 'Загрузка артистов...'}
                  </p>
                ) : (
                  filteredArtists.map((artist) => (
                    <div key={artist.id} className="flex items-center space-x-2 p-1 rounded hover:bg-muted/50">
                      <Checkbox
                        id={artist.id}
                        checked={selectedArtists.includes(artist.username)}
                        onCheckedChange={(checked) => 
                          handleArtistSelect(artist.username, checked as boolean)
                        }
                      />
                      <label 
                        htmlFor={artist.id} 
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {artist.name}
                        {recentArtists.some(ra => ra.id === artist.id) && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Новый релиз
                          </Badge>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>

              <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                Выбрано: <span className="font-semibold text-foreground">{selectedArtists.length}</span> артистов
              </div>
            </div>

            {/* Запуск парсинга */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Парсинг</h3>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={runVKParser}
                  disabled={isParsingVK || selectedArtists.length === 0}
                  className="w-full h-12 text-sm font-medium"
                  size="lg"
                >
                  {isParsingVK ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Парсинг VK...
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4 mr-2" />
                      Парсить VK
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={runBandlinkParser}
                  disabled={isParsingBandlink || selectedArtists.length === 0}
                  variant="secondary"
                  className="w-full h-12 text-sm font-medium"
                  size="lg"
                >
                  {isParsingBandlink ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Парсинг Bandlink...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Парсить Bandlink
                    </>
                  )}
                </Button>

                <Button 
                  onClick={clearResults}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Очистить результаты
                </Button>
              </div>
            </div>

            {/* Лог парсинга */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Статус</h3>
              </div>

              <div className="bg-background/50 rounded-lg p-3 border min-h-[200px]">
                {parsingOutput ? (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {parsingOutput}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Логи парсинга появятся здесь</p>
                    </div>
                </div>
              )}
              </div>
            </div>
          </div>
            </CardContent>
          </Card>
    </TabsContent>

    </Tabs>
      </div>
    </Layout>
  )
}