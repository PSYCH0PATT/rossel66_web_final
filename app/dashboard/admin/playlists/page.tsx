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
import { Play, Music, Trash2, RefreshCw, Search, Users, Clock, Settings, Cookie, Save, CheckCircle, XCircle, AlertCircle, UserPlus } from 'lucide-react'
import Image from 'next/image'
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Artist {
  id: string
  name: string
  username: string
}

interface VKPlaylist {
  id: number
  artist_url?: string
  artist_name: string
  playlist_name: string
  playlist_url: string
  playlist_cover_url: string
  platform?: string
  playlist_id?: string
  owner_id?: string
  parsed_at: string
  added_at?: string
  tracks_count?: number
  multiple_tracks?: boolean
  track_position?: number | null
  track_names?: string
  tracks_info?: any[]
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
  added_at: string
  parsed_at: string
  tracks_count?: number
  multiple_tracks?: boolean
  track_position?: number | null
  tracks_info?: any[]
}

export default function PlaylistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [recentArtists, setRecentArtists] = useState<Artist[]>([])
  const [selectedArtists, setSelectedArtists] = useState<string[]>([])
  const [vkResults, setVkResults] = useState<VKPlaylist[]>([])
  const [bandlinkResults, setBandlinkResults] = useState<BandlinkPlaylist[]>([])
  const [isParsingVK, setIsParsingVK] = useState(false)
  const [isParsingBandlink, setIsParsingBandlink] = useState(false)
  const [isSftpSyncing, setIsSftpSyncing] = useState(false)
  const [parsingOutput, setParsingOutput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'added_at' | 'parsed_at'>('added_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [windowWidth, setWindowWidth] = useState(0)
  
  // Состояния для управления cookies
  const [cookiesInput, setCookiesInput] = useState('')
  const [isUpdatingCookies, setIsUpdatingCookies] = useState(false)
  const [cookiesStatus, setCookiesStatus] = useState<{type: 'default'|'destructive', message: string} | null>(null)
  const [lastCookiesUpdate, setLastCookiesUpdate] = useState<string | null>(null)
  const [vkCookiesInput, setVkCookiesInput] = useState('')
  const [isUpdatingVkCookies, setIsUpdatingVkCookies] = useState(false)
  const [vkCookiesStatus, setVkCookiesStatus] = useState<{type: 'default'|'destructive', message: string} | null>(null)
  const [lastVkCookiesUpdate, setLastVkCookiesUpdate] = useState<string | null>(null)
  
  // Состояния для истории парсинга
  const [parsingHistory, setParsingHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  // Состояния для привязки плейлиста к артисту
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<{id: number, name: string, type: 'vk' | 'bandlink'} | null>(null)
  const [selectedArtistForAssign, setSelectedArtistForAssign] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    loadArtists()
    loadRecentArtists()
    loadResults()
    loadCookiesStatus()
    checkCookiesNotification()
    loadParsingHistory()
    loadVkCookiesStatus()
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
      // Загружаем только SFTP плейлисты из Supabase
      const response = await fetch('/api/playlists/sftp')
      const data = await response.json()
      
      if (!data.success) {
        console.error('Ошибка загрузки SFTP плейлистов:', data.error)
        return
      }
      
      const allPlaylists = data.results || []
      
      // Разделяем по платформам: VK -> vkResults, остальные -> bandlinkResults
      const vkFormatted: VKPlaylist[] = []
      const bandlinkFormatted: BandlinkPlaylist[] = []
      
      for (const p of allPlaylists) {
        const currentArtistName = p.artist_name || ''
        
        // Формируем названия релизов
        let trackNames = ''
        if (p.tracks_info && p.tracks_info.length > 0) {
          const artistReleases = p.tracks_info
            .map((t: any) => t.releaseName || t.title)
            .filter((name: string, index: number, arr: string[]) => name && arr.indexOf(name) === index)
          trackNames = artistReleases.join(', ')
        } else if (p.release_names && p.release_names.length > 0) {
          trackNames = p.release_names.join(', ')
        }
        
        const platform = (p.platform || '').trim()
        
        if (platform === 'VK Музыка') {
          vkFormatted.push({
            id: p.id,
            artist_url: '',
            artist_name: currentArtistName,
            playlist_name: p.playlist_name,
            playlist_url: p.playlist_url,
            playlist_cover_url: p.playlist_cover_url || "/placeholder.svg",
            playlist_id: '',
            owner_id: '',
            parsed_at: p.parsed_at || p.added_at,
            added_at: p.added_at || p.parsed_at,
            tracks_count: p.tracks_count || 0,
            multiple_tracks: p.multiple_tracks || false,
            track_position: p.track_position,
            track_names: trackNames,
            tracks_info: p.tracks_info || []
          })
        } else {
          bandlinkFormatted.push({
            id: p.id,
            artist_name: currentArtistName,
            playlist_name: p.playlist_name,
            playlist_artist: currentArtistName,
            track_names: trackNames,
            likes_count: '',
            platform: platform,
            playlist_cover_url: p.playlist_cover_url || "/placeholder.svg",
            playlist_url: p.playlist_url,
            added_at: p.added_at || p.parsed_at,
            parsed_at: p.parsed_at || p.added_at,
            tracks_count: p.tracks_count || 0,
            multiple_tracks: p.multiple_tracks || false,
            track_position: p.track_position,
            tracks_info: p.tracks_info || []
          })
        }
      }
      
      setVkResults(vkFormatted)
      setBandlinkResults(bandlinkFormatted)
    } catch (error) {
      console.error('Ошибка загрузки плейлистов:', error)
    }
  }
  
  // Функция для ручного запуска SFTP синхронизации
  const runManualParser = async () => {
    if (!confirm('Запустить синхронизацию плейлистов с SFTP сервером? Это может занять некоторое время.')) {
      return
    }
    
    setIsSftpSyncing(true)
    setParsingOutput('🔄 Запуск синхронизации SFTP...\n')
    
    try {
      setParsingOutput(prev => prev + '📥 Подключение к SFTP серверу...\n')
      
      // Эндпоинт сам подставляет CRON_SECRET на сервере — с клиента секрет не передаём
      const response = await fetch('/api/playlists/sync-sftp')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setParsingOutput(prev => prev + `✅ Синхронизация завершена\n`)
        setParsingOutput(prev => prev + `📥 Скачано файлов: ${data.stats?.downloaded || 0}\n`)
        setParsingOutput(prev => prev + `➕ Добавлено плейлистов: ${data.stats?.added || 0}\n`)
        setParsingOutput(prev => prev + `🔄 Обновлено плейлистов: ${data.stats?.updated || 0}\n`)
        setParsingOutput(prev => prev + `🗑️  Удалено плейлистов: ${data.stats?.removed || 0}\n`)
        loadResults()
      } else {
        setParsingOutput(prev => prev + `❌ Ошибка: ${data.error || 'Неизвестная ошибка'}\n`)
        if (data.details) {
          setParsingOutput(prev => prev + `Детали: ${data.details}\n`)
        }
      }
    } catch (error: any) {
      console.error('Ошибка SFTP синхронизации:', error)
      setParsingOutput(prev => prev + `❌ Ошибка запроса: ${error?.message || String(error)}\n`)
    } finally {
      setIsSftpSyncing(false)
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

  // Загрузка статуса cookies
  const loadCookiesStatus = async () => {
    try {
      const response = await fetch('/api/bandlink/cookies')
      const data = await response.json()
      if (data.success && data.lastUpdated) {
        setLastCookiesUpdate(new Date(data.lastUpdated).toLocaleString('ru-RU'))
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса cookies:', error)
    }
  }

  // Проверка уведомлений о необходимости новых cookies
  const checkCookiesNotification = async () => {
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      if (data.hasNotification) {
        setCookiesStatus({ 
          type: 'destructive', 
          message: data.message || '⚠️ Требуются новые cookies! Парсинг не работает.' 
        })
      }
    } catch (error) {
      console.error('Ошибка проверки уведомлений:', error)
    }
  }

  // Загрузка истории парсинга
  const loadParsingHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch('/api/parsers/history?type=all&limit=10')
      const data = await response.json()
      if (data.success) {
        setParsingHistory(data.history || [])
      }
    } catch (error) {
      console.error('Ошибка загрузки истории парсинга:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Загрузка статуса VK cookies
  const loadVkCookiesStatus = async () => {
    try {
      const response = await fetch('/api/vk/cookies')
      const data = await response.json()
      if (data.success && data.lastUpdated) {
        setLastVkCookiesUpdate(new Date(data.lastUpdated).toLocaleString('ru-RU'))
      }
    } catch (error) {
      console.error('Ошибка загрузки статуса VK cookies:', error)
    }
  }

  // Обновление cookies Bandlink
  const updateCookies = async () => {
    if (!cookiesInput.trim()) {
      setCookiesStatus({ type: 'destructive', message: 'Введите cookies для Bandlink' })
      return
    }

    setIsUpdatingCookies(true)
    setCookiesStatus(null)

    try {
      const response = await fetch('/api/bandlink/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: cookiesInput })
      })
      const data = await response.json()
      
      if (data.success) {
        setCookiesStatus({ type: 'default', message: `✅ ${data.message}` })
        setLastCookiesUpdate(new Date().toLocaleString('ru-RU'))
        setCookiesInput('')
        
        // Перезагружаем статус cookies
        await loadCookiesStatus()
      } else {
        setCookiesStatus({ type: 'destructive', message: `❌ ${data.error || 'Ошибка обновления'}` })
      }
    } catch (error) {
      setCookiesStatus({ type: 'destructive', message: '❌ Ошибка соединения' })
    } finally {
      setIsUpdatingCookies(false)
    }
  }

  // Обновление cookies VK
  const updateVkCookies = async () => {
    if (!vkCookiesInput.trim()) {
      setVkCookiesStatus({ type: 'destructive', message: 'Введите cookies для VK' })
      return
    }

    setIsUpdatingVkCookies(true)
    setVkCookiesStatus(null)

    try {
      const response = await fetch('/api/vk/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: vkCookiesInput })
      })
      const data = await response.json()
      
      if (data.success) {
        setVkCookiesStatus({ type: 'default', message: `✅ ${data.message}` })
        setLastVkCookiesUpdate(new Date().toLocaleString('ru-RU'))
        setVkCookiesInput('')
        
        // Перезагружаем статус cookies
        await loadVkCookiesStatus()
      } else {
        setVkCookiesStatus({ type: 'destructive', message: `❌ ${data.error || 'Ошибка обновления'}` })
      }
    } catch (error) {
      setVkCookiesStatus({ type: 'destructive', message: '❌ Ошибка соединения' })
    } finally {
      setIsUpdatingVkCookies(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
        loadParsingHistory() // Обновляем историю
        loadResults() // Обновляем результаты
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка VK парсинга: ' + data.error + '\n')
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n')
        }
        loadParsingHistory() // Обновляем историю даже при ошибке
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n')
      loadParsingHistory()
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
        loadParsingHistory() // Обновляем историю
        loadResults() // Обновляем результаты
        setBandlinkResults(data.results || [])
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка Bandlink парсинга: ' + data.error + '\n')
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n')
        }
        loadParsingHistory() // Обновляем историю даже при ошибке
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n')
      loadParsingHistory()
    } finally {
      setIsParsingBandlink(false)
    }
  }

  // Фильтрация артистов
  const filteredArtists = artists.filter(artist => 
    artist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artist.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Фильтрация и сортировка плейлистов
  const filterAndSortPlaylists = (playlists: any[], artistFilter: string) => {
    // Фильтрация по артисту
    let filtered = playlists
    if (artistFilter !== 'all') {
      filtered = playlists.filter(playlist => 
      playlist.artist_name === artistFilter || playlist.artist_name?.includes(artistFilter)
    )
  }

    // Сортировка
    return filtered.sort((a, b) => {
      const dateA = new Date(a[sortBy] || a.parsed_at).getTime()
      const dateB = new Date(b[sortBy] || b.parsed_at).getTime()
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
    })
  }

  // Группировка плейлистов по платформам с фильтрацией и сортировкой
  const vkPlaylists = filterAndSortPlaylists(vkResults, selectedArtistFilter)
  const yandexPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter(p => p.platform === 'Яндекс Музыка'), 
    selectedArtistFilter
  )
  const mtsPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter(p => p.platform === 'МТС Музыка'), 
    selectedArtistFilter
  )
  const sberPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter(p => p.platform === 'Сбер Музыка'), 
    selectedArtistFilter
  )
  const okPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter(p => p.platform === 'Одноклассники'), 
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

  const openAssignModal = (id: number, name: string, type: 'vk' | 'bandlink') => {
    setSelectedPlaylist({ id, name, type })
    setSelectedArtistForAssign('')
    setAssignModalOpen(true)
  }

  const assignPlaylistToArtist = async () => {
    if (!selectedPlaylist || !selectedArtistForAssign) {
      alert('Выберите артиста')
      return
    }

    setIsAssigning(true)
    try {
      const response = await fetch('/api/playlists/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          playlistId: selectedPlaylist.id, 
          artistId: selectedArtistForAssign 
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        alert('Плейлист успешно привязан к артисту!')
        setAssignModalOpen(false)
        loadResults()
      } else {
        alert('Ошибка привязки: ' + data.error)
      }
    } catch (error) {
      console.error('Ошибка привязки плейлиста:', error)
      alert('Ошибка привязки плейлиста')
    } finally {
      setIsAssigning(false)
    }
  }

  // Единый маппинг платформы -> цвет бейджа (VK, Яндекс, МТС, Сбер и т.д.)
  const getPlatformBadgeStyle = (platform: string) => {
    const p = (platform || '').trim()
    if (p === 'VK Музыка') return { bg: '#0077FF', color: '#FFFFFF' }
    if (p === 'Яндекс Музыка') return { bg: '#FFCC00', color: '#000000' }
    if (p === 'МТС Музыка' || p === 'MTS Music') return { bg: '#E30611', color: '#FFFFFF' }
    if (p === 'Сбер Музыка' || p === 'Sber Music') return { bg: '#21A038', color: '#FFFFFF' }
    if (p === 'Одноклассники') return { bg: '#EE8208', color: '#FFFFFF' }
    return { bg: '#6b7280', color: '#FFFFFF' }
  }

  const PlaylistCard = ({ playlist, type }: { playlist: VKPlaylist | BandlinkPlaylist, type: 'vk' | 'bandlink' }) => {
    const tracksCount = (playlist as any).tracks_count || ((playlist as any).multiple_tracks ? 2 : 1)
    const hasMultipleTracks = tracksCount > 1
    const isVK = type === 'vk'
    const vkPlaylist = playlist as VKPlaylist
    const bandlinkPlaylist = playlist as BandlinkPlaylist
    const platformName = isVK ? (vkPlaylist.platform || 'VK Музыка') : bandlinkPlaylist.platform
    const badgeStyle = getPlatformBadgeStyle(platformName)
    
    // Получаем позицию трека в плейлисте (для отображения "X место")
    const getTrackPosition = () => {
      if (isVK) {
        if (vkPlaylist.track_position != null && !isNaN(vkPlaylist.track_position)) {
          return vkPlaylist.track_position;
        }
        if (vkPlaylist.tracks_info && vkPlaylist.tracks_info.length > 0) {
          const positions = vkPlaylist.tracks_info
            .map((t: any) => t.position)
            .filter((p: number) => p != null && !isNaN(p) && isFinite(p));
          if (positions.length > 0) {
            return Math.min(...positions);
          }
        }
      } else {
        if (bandlinkPlaylist.track_position != null && !isNaN(bandlinkPlaylist.track_position)) {
          return bandlinkPlaylist.track_position;
        }
        if (bandlinkPlaylist.tracks_info && bandlinkPlaylist.tracks_info.length > 0) {
          const positions = bandlinkPlaylist.tracks_info
            .map((t: any) => t.position)
            .filter((p: number) => p != null && !isNaN(p) && isFinite(p));
          if (positions.length > 0) {
            return Math.min(...positions);
          }
        }
      }
      return null;
    };
    
    const trackPosition = getTrackPosition();
    
    // Форматируем дату
    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      } catch {
        return dateString;
      }
    };
    
    const displayDate = isVK 
      ? formatDate(vkPlaylist.added_at || vkPlaylist.parsed_at)
      : formatDate(bandlinkPlaylist.added_at || bandlinkPlaylist.parsed_at)

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
              {/* Кнопка привязки к артисту */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openAssignModal(playlist.id, isVK ? vkPlaylist.playlist_name : bandlinkPlaylist.playlist_name, type)
                }}
                className="absolute top-2 left-2 p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                title="Привязать к артисту"
              >
                <UserPlus className="w-3 h-3" />
              </button>
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
                style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}
              >
                {platformName}
              </Badge>

              <div className="text-xs text-muted-foreground line-clamp-1 font-medium">
                {isVK ? vkPlaylist.artist_name : bandlinkPlaylist.artist_name}
                {trackPosition !== null && trackPosition !== undefined && !isNaN(trackPosition) && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {trackPosition} место
                  </Badge>
                )}
              </div>

              {/* Названия релизов - только для этого артиста */}
              {(() => {
                const currentArtistName = isVK ? vkPlaylist.artist_name : bandlinkPlaylist.artist_name;
                const tracksInfo = isVK ? (vkPlaylist.tracks_info || []) : (bandlinkPlaylist.tracks_info || []);
                
                // Фильтруем релизы только для текущего артиста
                const artistReleases = tracksInfo
                  .filter((t: any) => {
                    // Проверяем, что трек принадлежит текущему артисту
                    // Извлекаем имя артиста из title или releaseName
                    const trackTitle = t.title || t.releaseName || '';
                    const trackArtistMatch = trackTitle.match(/^([^-]+?)\s*-\s*/);
                    const trackArtist = trackArtistMatch ? trackArtistMatch[1].trim() : '';
                    return !trackArtist || trackArtist.toLowerCase() === currentArtistName.toLowerCase();
                  })
                  .map((t: any) => t.releaseName || t.title)
                  .filter((name: string, index: number, arr: string[]) => name && arr.indexOf(name) === index);
                
                const releaseNames = isVK 
                  ? (vkPlaylist.track_names || artistReleases.join(', '))
                  : (bandlinkPlaylist.track_names || artistReleases.join(', '));
                
                if (releaseNames && releaseNames.trim()) {
                  return (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Релизы:</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {releaseNames}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Дата */}
              {displayDate && (
                <div className="text-xs text-muted-foreground">
                  {displayDate}
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
              Парсинг (резерв)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-6">
            {/* Фильтр и сортировка */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-medium">Фильтр:</span>
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
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-medium">Сортировка:</span>
                  </div>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'added_at' | 'parsed_at')}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="added_at">По дате добавления</SelectItem>
                      <SelectItem value="parsed_at">По дате парсинга</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Сначала новые</SelectItem>
                      <SelectItem value="asc">Сначала старые</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="text-sm text-muted-foreground ml-auto">
                    Показано: {vkPlaylists.length + yandexPlaylists.length + mtsPlaylists.length + sberPlaylists.length + okPlaylists.length} плейлистов
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
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAApVBMVEX0X/8Ad//////zVP/7zf/70v/7z//0XP/2X//7Xv/0V//5Xv/zU//9Xv///f8Adv/4nv/1av/6wP/5sP/mYP/XYv+8Zv/4pf/+9P/3mP/6vP/6v//0Y//+8P/93v/fYf+IbP/2gf+xZ//3jv/1c//1ef/81//7yP/+8f/94f8vdP/MZP9Ocv9qb/+saP9Cc/+cav+Abf+Bbf/2iP/96P/4qf/3jP/cI5qYAAAGjElEQVR4nO2d7XaiOhRAc2VmIgFErWDVqqjVtiqt/XDe/9EuVNsiCRolIYlz9s9ZZx2zGxLISWDQf9cOUt0A6YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+YCh+ehn6O8Qlk8jw2X8uglXQTDudDrjcRCsnqPX9bJ0Wk0MX6KwgxzbceoZnOQfUGe1iUt1qAaGfjxFqRtikoja3nh6uaVqQz8OEz22XEbT8dAqernoF9Qarqed03pfljYKogt6UqVhHDi8et+Sq/jcX1Fm6Ecdr2DoHcPxOpvz5ldFhomffb7eDhuF6zN+So1h4ndB//10pHPGxarCMC7nl1K3A95+rN5wHVwy/mhHL+Drx6oNl2HRrf18R3vFc4es2DBC590fjuM44ekbZKWG6/HFE2iRo7c59aMVGvrPwi7QDHbnxHCszjC+/A54lLqzOvoIUJWhH5a+QxTioEi9YSx0hqHwguJZtRJDP/Rk+iU49cIZpwrDuCO1A3fYQcFolG+YdKC0EZjFcdijUbphJR24w2NOqrINpzLugUU4rHujXMN1dR34Sd15rtZwU80IzEJPOBINXwI5DzHHcVDuSpVnuJF7ky/GPrxSZRkulXTgXjHIrqkkGb7JewrlwEGZEocUw+VKXQd+Us/c/WUYil3IX4Y9lWeovAN3fA9G4YblOxCnlFd0OmsZhi9B2XUScVuT98mdS0or1ncLY7GGm3rJDiRW96OW8rEl5R0/B6NIw3XpSow1u619cTuzyismz3DiDJfT0vdA96aW5cYtrZgMRmGGAm4RpFk7pCdiMAoyFFHrxfc5wVqjJWBOFWK4FFKoIL/yhrWH8kNRhKEvZhWBWw3KUEgnlhZ8E7SOJz1KMBmJ6g3F1epJm2HYLz/XlDOMxex2fmLRw7BW+yNgIJbyE7kKZBr+VmkYB2ILhZoZ+q8XnYY5hlaGy0350xQUGhmuQySjCqOLoR+Nuc/anYcWhn4c1qUV0TQwjM84KnkBqg0TvcJjvGJQabh8DR1PeoFQleEyngaOzIvzGxWG67dwjOyqtjirNfTX0TRA9crsUqow9JfLdRw9hwHyPMnTCgNphlEUbTbPYbhaBeOO49nFbz6IAGNSVM8+y/BIHgpnT/qSykWN5gcT977X7M1dwmocvyG23PlnHktEoUogpNXfVWJuBy3G0p3bkLTa+zwPrDzqsLqZlnfppvEaupk8jW75orEw3MMyTJtqGqeh2z+RRxXWTa7tN/m28xlSebYiSqoCwBOq8ZPcNMFlyMgz12O6sX5TLVvkhiKXIVmc7mYl0FsSCfeHf3weQ9yiQxr3OnQitauU0jzsRB5DnjxqsFj17PZh63kM2Xm0MGS1/tcFhhx51CDM8A8YqkJ/w2RV4J56kj8Wo7shIX8Hi9Gi/X7kiAshs3YaM2PG6G2ISffrkMttt2DZifFPzJYRo7Uhbo0y2UZ3LEV893Q8RmdDfDc8SDdkKGL8cRiD8jE6G1qjXL4RY+16MkZjQ8aDILU854jR2BAPqYTD/CWYu0ZZMfoa4ndGxtySk7EopWL0NST5mkHKDTk7Rl9D64GRMXfYjCtGX0OOUzyMAgVf68EQDMEQDMEQDMEQDMEQDHkNr/7Jm2wZGXlWT1tTVk88q1tmzMSUFTAiPFWM0zE6G9JVJuqVOdKlYvKblhobIpejmng6RmdDfHd7kI6u9qYxjydidDZEuJWt2D8xBPMxH3SM1oYIu9+7LsOuW7AzY3W/uvGRFaO3YTKV4Fl/9DQazPCR3TXc6y+eFm12jO6G+91P5plJvhj9DcsChoUxYHh9hvqeGOI4rcVlyFqpDXQ49XX9J/dknr7M51GERZ98XeSGD98JWsZJXB2GYfLHn1Mty59e5jsFfTqPKqSdZKfyKMMS9DaCNTgI6GvzNkL6JsjPt0saTbph/G+UZL6B0tSmB1NIq79bhpV+K2iwW6o9MvOoBFto0mv2Joh5RvOcN7vwkTyKUfF2njZIe8NSG8DQfMDQfMDQfMDQfMDQfMDQfP5RQxFfhtQG0mcYivi6pzawv9B6TYbMrwkI+VSyNhB660yLbSVx4Pv8p5L1+CCEQKidJS12lYTiHh6F3GpUzxaFO/s5XTX8e12DcA/B3ad0NDY+uujqLtE9hLTm7/OWgP/dQl8E/S8sAAAAAAAAAAAAAAAAAAAAAAAAAAAAef4HdHjBZGjBRxYAAAAASUVORK5CYII=" 
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

            {/* Сбер Музыка */}
            {sberPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="/images/playlists/sber-music.png" 
                      alt="Сбер Музыка" 
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Сбер Музыка</h2>
                  <Badge 
                    className="border-0"
                    style={{ backgroundColor: "#21A038", color: "#FFFFFF" }}
                  >
                    {sberPlaylists.length}
                  </Badge>
                </div>
                <div 
                  className="grid gap-3" 
                  style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                >
                  {sberPlaylists.map((playlist) => (
                    <PlaylistCard key={`sber-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                </div>
              </div>
            )}

            {/* Пустое состояние */}
            {/* Одноклассники */}
            {okPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="/placeholder.svg" 
                      alt="Одноклассники" 
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <h2 className="text-xl font-semibold text-white">Одноклассники</h2>
                  <Badge 
                    className="border-0"
                    style={{ backgroundColor: "#EE8208", color: "#FFFFFF" }}
                  >
                    {okPlaylists.length}
                  </Badge>
                </div>
                <div 
                  className="grid gap-3" 
                  style={{ gridTemplateColumns: `repeat(${currentColumns}, minmax(0, 1fr))` }}
                >
                  {okPlaylists.map((playlist) => (
                    <PlaylistCard key={`ok-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                </div>
              </div>
            )}

            {vkPlaylists.length === 0 && yandexPlaylists.length === 0 && mtsPlaylists.length === 0 && sberPlaylists.length === 0 && okPlaylists.length === 0 && (
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
            {/* Группировка плейлистов по артистам. VK только из vkResults; Bandlink — всё кроме VK (чтобы не дублировать). */}
            {getUniqueArtists().map(artistName => {
              const artist = artists.find(a => a.name === artistName)
              const artistVKPlaylists = vkResults.filter(p => p.artist_name === artistName)
              const artistBandlinkPlaylists = bandlinkResults.filter(
                p => p.artist_name === artistName && p.platform !== 'VK Музыка'
              )
              const totalPlaylists = artistVKPlaylists.length + artistBandlinkPlaylists.length

              if (totalPlaylists === 0) return null

              return (
                <div key={artistName} className="space-y-4">
                  {/* Заголовок артиста */}
                  <div className="flex items-center gap-4 border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
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
                      {artistBandlinkPlaylists.filter(p => p.platform === 'Сбер Музыка').length > 0 && (
                        <Badge style={{ backgroundColor: "#21A038", color: "#FFFFFF" }}>
                          Сбер: {artistBandlinkPlaylists.filter(p => p.platform === 'Сбер Музыка').length}
                        </Badge>
                      )}
                      {artistBandlinkPlaylists.filter(p => p.platform === 'Одноклассники').length > 0 && (
                        <Badge style={{ backgroundColor: "#EE8208", color: "#FFFFFF" }}>
                          ОК: {artistBandlinkPlaylists.filter(p => p.platform === 'Одноклассники').length}
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
            {/* Информация о SFTP синхронизации */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Синхронизация SFTP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    По умолчанию плейлисты синхронизируются с SFTP сервером автоматически в 16:00 и 00:30 ежедневно.
                    Система подключается к SFTP серверу, скачивает CSV файлы и парсит их автоматически.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={runManualParser}
                  disabled={isSftpSyncing}
                  className="w-full"
                >
                  {isSftpSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Синхронизация...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Запустить синхронизацию SFTP
                    </>
                  )}
                </Button>
                
                {/* Вывод парсинга */}
                {parsingOutput && (
                  <div className="mt-4 p-4 bg-muted rounded-lg border">
                    <div className="text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {parsingOutput}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Существующий контент парсинга */}
            {/* Панель управления парсингом */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Первая строка: Выбор артистов и Парсинг */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                  </div>

                  {/* Вторая строка: История парсинга */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold">История парсинга</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadParsingHistory}
                        disabled={isLoadingHistory}
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

              <div className="bg-background/50 rounded-lg p-3 border min-h-[200px] max-h-[400px] overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : parsingHistory.length > 0 ? (
                  <div className="space-y-3">
                    {parsingHistory.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2 bg-background/30">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.parser_type === 'bandlink' ? 'default' : 'secondary'} className="text-xs">
                            {item.parser_type === 'bandlink' ? 'Bandlink' : 'VK'}
                          </Badge>
                          {item.status === 'completed' ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : item.status === 'failed' ? (
                            <XCircle className="w-3 h-3 text-red-500" />
                          ) : (
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                          )}
                          <span className="text-xs font-medium">
                            {item.status === 'completed' ? 'Успешно' : item.status === 'failed' ? 'Ошибка' : 'Выполняется'}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDateTime(item.started_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <strong>Артисты:</strong> {item.artists}
                        </p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Найдено: <span className="font-medium text-foreground">{item.playlists_found || 0}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Добавлено: <span className="font-medium text-green-500">{item.playlists_added || 0}</span>
                          </span>
                        </div>
                        {item.errors && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                            <div className="flex items-center gap-1 mb-1">
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              <span className="font-medium text-red-500">Ошибки:</span>
                            </div>
                            <pre className="text-red-400 whitespace-pre-wrap text-xs">{item.errors}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">История парсинга пуста</p>
                      <p className="text-xs mt-1">Запустите парсинг, чтобы увидеть историю</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

                  {/* Третья строка: Cookies */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Управление Cookies Bandlink */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Cookies Bandlink</h3>
              </div>
              
              <Textarea
                placeholder={`Вставьте cookies для Bandlink в формате строки (каждая строка: name=value):\n_yascZbPBpGejBI8wyUctjcuMZQX8ThOZfHYB5DN8GWR3zkzmGIuIN9V4/Lu9t62ssa13vA==\n_ym_d1768914125\n...`}
                value={cookiesInput}
                onChange={(e) => setCookiesInput(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              
              <Button
                onClick={updateCookies}
                disabled={isUpdatingCookies || !cookiesInput.trim()}
                size="sm"
                className="w-full"
              >
                {isUpdatingCookies ? (
                  <><RefreshCw className="w-3 h-3 mr-2 animate-spin" />Обновление...</>
                ) : (
                  <><Save className="w-3 h-3 mr-2" />Обновить Cookies</>
                )}
              </Button>
              
              {cookiesStatus && (
                <Alert variant={cookiesStatus.type}>
                  <AlertDescription>{cookiesStatus.message}</AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                <p>Последнее обновление:</p>
                <p className="font-mono">{lastCookiesUpdate || 'Не обновлялись'}</p>
              </div>
            </div>

            {/* Управление Cookies VK */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Cookies VK</h3>
              </div>
              
              <Textarea
                placeholder={`Вставьте cookies для VK в формате строки (каждая строка: name=value):\nadblock1\ndomain_sidw3y9a5vc6Kz6rEXNpmFZX%3A1768866028820\nhttokenjzx5WH7NpAcA8fnDeklUB6xDpwlgX4bAGyi5jYNGT3JsF-q-K7ACAWN3IXZXjmJgIBzPumtgTSgGud6x72Oy5EhMpk9kajtz_W3WaSDbQwXUjzV9HLoIEj5KZG8v5hbFK1k\n...`}
                value={vkCookiesInput}
                onChange={(e) => setVkCookiesInput(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              
              <Button
                onClick={updateVkCookies}
                disabled={isUpdatingVkCookies || !vkCookiesInput.trim()}
                size="sm"
                className="w-full"
              >
                {isUpdatingVkCookies ? (
                  <><RefreshCw className="w-3 h-3 mr-2 animate-spin" />Обновление...</>
                ) : (
                  <><Save className="w-3 h-3 mr-2" />Обновить Cookies</>
                )}
              </Button>
              
              {vkCookiesStatus && (
                <Alert variant={vkCookiesStatus.type}>
                  <AlertDescription>{vkCookiesStatus.message}</AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                <p>Последнее обновление:</p>
                <p className="font-mono">{lastVkCookiesUpdate || 'Не обновлялись'}</p>
              </div>
            </div>
                  </div>
                </div>
            </CardContent>
          </Card>
    </TabsContent>

    </Tabs>
      </div>

      {/* Модальное окно для привязки плейлиста к артисту */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAssignModalOpen(false)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Привязать плейлист к артисту</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Плейлист:</p>
                <p className="font-medium">{selectedPlaylist?.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Выберите артиста:</label>
                <Select value={selectedArtistForAssign} onValueChange={setSelectedArtistForAssign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите артиста" />
                  </SelectTrigger>
                  <SelectContent>
                    {artists.map(artist => (
                      <SelectItem key={artist.id} value={artist.id}>
                        {artist.name} (@{artist.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={() => setAssignModalOpen(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={isAssigning}
                >
                  Отмена
                </Button>
                <Button
                  onClick={assignPlaylistToArtist}
                  className="flex-1"
                  disabled={isAssigning || !selectedArtistForAssign}
                >
                  {isAssigning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Привязка...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Привязать
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}