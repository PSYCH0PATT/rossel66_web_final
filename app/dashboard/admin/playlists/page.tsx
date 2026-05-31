"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

/** Строка платформы из CSV может не совпадать с канонич. «Яндекс Музыка» — группируем по подстроке */
function platformNorm(p: string | undefined) {
  return (p || "").trim().toLowerCase()
}
function isVkMusicPlatform(platform: string | undefined) {
  const n = platformNorm(platform)
  return n.includes("vk") || n.includes("вк")
}
function isYandexMusicPlatform(platform: string | undefined) {
  const n = platformNorm(platform)
  return n.includes("yandex") || n.includes("яндекс")
}
function isMtsMusicPlatform(platform: string | undefined) {
  const n = platformNorm(platform)
  return n.includes("mts") || n.includes("мтс")
}
function isSberMusicPlatform(platform: string | undefined) {
  const n = platformNorm(platform)
  return n.includes("sber") || n.includes("сбер")
}
function isOdnoklassnikiPlatform(platform: string | undefined) {
  const n = platformNorm(platform)
  return n.includes("одноклассник") || n.includes("odnoklassniki")
}

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
  const [playlistQuery, setPlaylistQuery] = useState('')
  const [debouncedPlaylistQuery, setDebouncedPlaylistQuery] = useState('')
  const [playlistTotal, setPlaylistTotal] = useState(0)
  const playlistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'added_at' | 'parsed_at'>('added_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
  const [actionBanner, setActionBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: "vk" | "bandlink" } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [sftpConfirmOpen, setSftpConfirmOpen] = useState(false)
  const [clearResultsOpen, setClearResultsOpen] = useState(false)
  /** Локальные CSV (sftp_downloads) и настройки импорта */
  const [sftpLocalFiles, setSftpLocalFiles] = useState<
    { name: string; dataRows: number; mtimeISO: string; sizeBytes: number }[]
  >([])
  const [sftpHints, setSftpHints] = useState<{ host?: string; remotePath?: string } | null>(null)
  const [selectedSftpCsv, setSelectedSftpCsv] = useState("")
  const [sftpCleanupRemoved, setSftpCleanupRemoved] = useState(false)
  const [sftpToolsBusy, setSftpToolsBusy] = useState(false)

  useEffect(() => {
    loadArtists()
    loadRecentArtists()
    void loadResults()
    const idle = window.setTimeout(() => {
      void loadCookiesStatus()
      void checkCookiesNotification()
      void loadParsingHistory()
      void loadVkCookiesStatus()
      void loadSftpLocalCsvList()
    }, 0)
    return () => window.clearTimeout(idle)
  }, [])

  useEffect(() => {
    void loadResults()
  }, [debouncedPlaylistQuery, selectedArtistFilter])

  const handlePlaylistSearch = (val: string) => {
    setPlaylistQuery(val)
    if (playlistDebounceRef.current) clearTimeout(playlistDebounceRef.current)
    playlistDebounceRef.current = setTimeout(() => {
      setDebouncedPlaylistQuery(val.trim())
    }, 350)
  }

  const appendSftpLog = (line: string) => {
    setParsingOutput((prev) => (prev ? `${prev}\n${line}` : line))
  }

  const loadSftpLocalCsvList = async () => {
    try {
      const res = await fetch("/api/playlists/sftp-admin")
      const data = await res.json()
      if (!res.ok || !data.success) {
        return
      }
      const files = data.files || []
      setSftpLocalFiles(files)
      setSftpHints(data.hints || null)
      setSelectedSftpCsv((cur) => {
        if (cur && files.some((f: { name: string }) => f.name === cur)) return cur
        return files[0]?.name || ""
      })
    } catch {
      /* ignore */
    }
  }

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
      const params = new URLSearchParams({ take: "100", skip: "0" })
      if (debouncedPlaylistQuery) params.set("q", debouncedPlaylistQuery)
      if (selectedArtistFilter !== "all") {
        const artist = artists.find((a) => a.name === selectedArtistFilter)
        if (artist?.id) params.set("artistId", artist.id)
      }
      const response = await fetch(`/api/playlists/sftp?${params}`)
      const data = await response.json()

      if (!data.success) {
        console.error("Ошибка загрузки SFTP плейлистов:", data.error, data.details)
        setActionBanner({
          type: "err",
          text: `Не удалось загрузить плейлисты: ${data.error || "ошибка API"}${data.details ? ` (${String(data.details).slice(0, 200)})` : ""}`,
        })
        return
      }
      
      const allPlaylists = data.results || []
      setPlaylistTotal(typeof data.total === "number" ? data.total : allPlaylists.length)
      
      // Разделяем по платформам: VK -> vkResults, остальные -> bandlinkResults
      const vkFormatted: VKPlaylist[] = []
      const bandlinkFormatted: BandlinkPlaylist[] = []
      
      for (const p of allPlaylists) {
        const currentArtistName = p.artist_name || ''
        
        // Формируем названия треков для блока «Релизы» (title = название трека, как в Yandex Lens)
        let trackNames = ''
        if (p.tracks_info && p.tracks_info.length > 0) {
          const artistReleases = p.tracks_info
            .map((t: any) => t.title || t.releaseName)
            .filter((name: string, index: number, arr: string[]) => name && arr.indexOf(name) === index)
          trackNames = artistReleases.join(', ')
        } else if (p.release_names && p.release_names.length > 0) {
          trackNames = p.release_names.join(', ')
        }
        
        const platform = (p.platform || '').trim()
        
        if (isVkMusicPlatform(platform)) {
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
  
  const runManualParser = async () => {
    setIsSftpSyncing(true)
    setParsingOutput("🔄 Полный цикл SFTP (новые файлы + применение последнего CSV)...\n")

    try {
      appendSftpLog("📥 Подключение к SFTP и обработка...")
      const q = sftpCleanupRemoved ? "?cleanupRemoved=1" : ""
      const response = await fetch(`/api/playlists/sync-sftp${q}`)

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Нужна сессия администратора (войдите заново)")
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        appendSftpLog("✅ Синхронизация завершена")
        appendSftpLog(`📥 Скачано новых файлов: ${data.stats?.downloaded ?? 0}`)
        appendSftpLog(`➕ Добавлено: ${data.stats?.added ?? 0}`)
        appendSftpLog(`🔄 Обновлено: ${data.stats?.updated ?? 0}`)
        if (data.stats?.unchanged != null) {
          appendSftpLog(`⏸ Без изменений: ${data.stats.unchanged}`)
        }
        appendSftpLog(`🗑️ Удалено (только если включена очистка): ${data.stats?.removed ?? 0}`)
        if (data.errors?.length) {
          appendSftpLog(`⚠️ ${data.errors.join("; ")}`)
        }
        await loadSftpLocalCsvList()
        loadResults()
      } else {
        appendSftpLog(`❌ ${data.error || "Ошибка"}`)
        if (data.errors?.length) appendSftpLog(data.errors.join("\n"))
      }
    } catch (error: unknown) {
      console.error("Ошибка SFTP синхронизации:", error)
      appendSftpLog(`❌ ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSftpSyncing(false)
    }
  }

  const sftpAdminPost = async (body: object) => {
    const res = await fetch("/api/playlists/sftp-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return data
  }

  const runSftpDownloadNew = async () => {
    setSftpToolsBusy(true)
    appendSftpLog("📥 Скачать только новые CSV с SFTP...")
    try {
      const data = await sftpAdminPost({ op: "download_new" })
      appendSftpLog(`Скачано файлов: ${data.downloaded ?? 0}`)
      if (data.files?.length) appendSftpLog(`Файлы: ${data.files.join(", ")}`)
      if (data.errors?.length) appendSftpLog(`⚠️ ${data.errors.join("; ")}`)
      await loadSftpLocalCsvList()
    } catch (e: unknown) {
      appendSftpLog(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSftpToolsBusy(false)
    }
  }

  const runSftpDownloadLatest = async () => {
    setSftpToolsBusy(true)
    appendSftpLog("📥 Скачать последний CSV с SFTP (перезапись локально)...")
    try {
      const data = await sftpAdminPost({ op: "download_latest" })
      if (data.filename) {
        appendSftpLog(`Файл: ${data.filename}`)
      } else {
        appendSftpLog(data.errors?.[0] || "Нет файла на сервере")
      }
      if (data.errors?.length && !data.filename) {
        appendSftpLog(data.errors.join("; "))
      }
      await loadSftpLocalCsvList()
    } catch (e: unknown) {
      appendSftpLog(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSftpToolsBusy(false)
    }
  }

  const runSftpApplySelected = async () => {
    if (!selectedSftpCsv) {
      appendSftpLog("⚠️ Выберите CSV в списке")
      return
    }
    setSftpToolsBusy(true)
    appendSftpLog(`💾 Применить к БД: ${selectedSftpCsv} (cleanup=${sftpCleanupRemoved ? "да" : "нет"})`)
    try {
      const data = await sftpAdminPost({
        op: "apply",
        filename: selectedSftpCsv,
        cleanupRemoved: sftpCleanupRemoved,
      })
      const imp = data.import
      if (imp) {
        appendSftpLog(`Плейлистов в файле: ${imp.playlistsParsed}, +${imp.added} / ~${imp.updated} / удалено ${imp.removed}`)
        if (imp.errors?.length) appendSftpLog(imp.errors.join("; "))
      }
      loadResults()
    } catch (e: unknown) {
      appendSftpLog(`❌ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSftpToolsBusy(false)
    }
  }

  const onSftpCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setSftpToolsBusy(true)
    appendSftpLog(`📤 Загрузка и импорт: ${file.name}`)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("cleanupRemoved", sftpCleanupRemoved ? "1" : "0")
      const res = await fetch("/api/playlists/sftp-admin", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      appendSftpLog(`Сохранено как ${data.savedAs}`)
      const imp = data.import
      if (imp) {
        appendSftpLog(`+${imp.added} / ~${imp.updated} / удалено ${imp.removed}`)
      }
      await loadSftpLocalCsvList()
      loadResults()
    } catch (err: unknown) {
      appendSftpLog(`❌ ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSftpToolsBusy(false)
    }
  }

  const clearResultsConfirmed = async () => {
    setClearResultsOpen(false)
    try {
      const response = await fetch("/api/parsers/clear", {
        method: "DELETE",
      })

      const data = await response.json()

      if (data.success) {
        setVkResults([])
        setBandlinkResults([])
        setParsingOutput((prev) => prev + "\n[OK] Все результаты парсинга очищены\n")
        setActionBanner({ type: "ok", text: "Результаты парсинга очищены" })
      } else {
        setActionBanner({ type: "err", text: "Ошибка очистки: " + (data.error || "") })
      }
    } catch (error) {
      console.error("Ошибка очистки результатов:", error)
      setActionBanner({ type: "err", text: "Ошибка очистки результатов" })
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
      setActionBanner({ type: "err", text: "Выберите артистов для парсинга" })
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
      setActionBanner({ type: "err", text: "Выберите артистов для парсинга" })
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
    bandlinkResults.filter((p) => isYandexMusicPlatform(p.platform)),
    selectedArtistFilter
  )
  const mtsPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter((p) => isMtsMusicPlatform(p.platform)),
    selectedArtistFilter
  )
  const sberPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter((p) => isSberMusicPlatform(p.platform)),
    selectedArtistFilter
  )
  const okPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter((p) => isOdnoklassnikiPlatform(p.platform)),
    selectedArtistFilter
  )
  /** Spotify, Apple и т.д. — не теряем из-за неточного названия платформы в CSV */
  const otherPlaylists = filterAndSortPlaylists(
    bandlinkResults.filter(
      (p) =>
        !isYandexMusicPlatform(p.platform) &&
        !isMtsMusicPlatform(p.platform) &&
        !isSberMusicPlatform(p.platform) &&
        !isOdnoklassnikiPlatform(p.platform)
    ),
    selectedArtistFilter
  )

  // Получение уникальных артистов из результатов
  const getUniqueArtists = () => {
    const artistsSet = new Set<string>()
    vkResults.forEach(p => artistsSet.add(p.artist_name))
    bandlinkResults.forEach(p => artistsSet.add(p.artist_name))
    return Array.from(artistsSet).sort()
  }

  const performDeletePlaylist = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const response = await fetch("/api/parsers/delete-playlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: deleteTarget.id, type: deleteTarget.type }),
      })

      const data = await response.json()

      if (data.success) {
        setDeleteTarget(null)
        loadResults()
        setActionBanner({ type: "ok", text: "Плейлист удалён" })
      } else {
        setActionBanner({ type: "err", text: "Ошибка удаления: " + (data.error || "") })
      }
    } catch (error) {
      console.error("Ошибка удаления плейлиста:", error)
      setActionBanner({ type: "err", text: "Ошибка удаления плейлиста" })
    } finally {
      setDeleteBusy(false)
    }
  }

  const openAssignModal = (id: number, name: string, type: 'vk' | 'bandlink') => {
    setSelectedPlaylist({ id, name, type })
    setSelectedArtistForAssign('')
    setAssignModalOpen(true)
  }

  const assignPlaylistToArtist = async () => {
    if (!selectedPlaylist || !selectedArtistForAssign) {
      setActionBanner({ type: "err", text: "Выберите артиста" })
      return
    }

    setIsAssigning(true)
    try {
      const response = await fetch("/api/playlists/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playlistId: selectedPlaylist.id,
          artistId: selectedArtistForAssign,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setActionBanner({ type: "ok", text: "Плейлист привязан к артисту" })
        setAssignModalOpen(false)
        loadResults()
      } else {
        setActionBanner({ type: "err", text: "Ошибка привязки: " + (data.error || "") })
      }
    } catch (error) {
      console.error("Ошибка привязки плейлиста:", error)
      setActionBanner({ type: "err", text: "Ошибка привязки плейлиста" })
    } finally {
      setIsAssigning(false)
    }
  }

  // Единый маппинг платформы -> цвет бейджа (VK, Яндекс, МТС, Сбер и т.д.)
  const getPlatformBadgeStyle = (platform: string) => {
    const n = platformNorm(platform)
    if (n.includes("vk") || n.includes("вк")) return { bg: "#0077FF", color: "#FFFFFF" }
    if (n.includes("yandex") || n.includes("яндекс")) return { bg: "#FFCC00", color: "#000000" }
    if (n.includes("mts") || n.includes("мтс")) return { bg: "#E30611", color: "#FFFFFF" }
    if (n.includes("sber") || n.includes("сбер")) return { bg: "#21A038", color: "#FFFFFF" }
    if (n.includes("одноклассник") || n.includes("odnoklassniki")) return { bg: "#EE8208", color: "#FFFFFF" }
    return { bg: "#6b7280", color: "#FFFFFF" }
  }

  const inputCls =
    "h-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  const PlaylistCard = ({ playlist, type }: { playlist: VKPlaylist | BandlinkPlaylist; type: "vk" | "bandlink" }) => {
    const tracksCount = (playlist as any).tracks_count || ((playlist as any).multiple_tracks ? 2 : 1)
    const isVK = type === "vk"
    const vkPlaylist = playlist as VKPlaylist
    const bandlinkPlaylist = playlist as BandlinkPlaylist
    const platformName = isVK ? vkPlaylist.platform || "VK Музыка" : bandlinkPlaylist.platform
    const dotColor = getPlatformBadgeStyle(platformName).bg
    const playlistUrl = isVK ? vkPlaylist.playlist_url : bandlinkPlaylist.playlist_url
    const coverUrl = isVK ? vkPlaylist.playlist_cover_url || "/placeholder.svg" : bandlinkPlaylist.playlist_cover_url || "/placeholder.svg"
    const title = isVK ? vkPlaylist.playlist_name : bandlinkPlaylist.playlist_name
    const artistName = isVK ? vkPlaylist.artist_name : bandlinkPlaylist.artist_name

    const getTrackPosition = () => {
      if (isVK) {
        if (vkPlaylist.track_position != null && !isNaN(vkPlaylist.track_position)) {
          return vkPlaylist.track_position
        }
        if (vkPlaylist.tracks_info && vkPlaylist.tracks_info.length > 0) {
          const positions = vkPlaylist.tracks_info
            .map((t: any) => t.position)
            .filter((p: number) => p != null && !isNaN(p) && isFinite(p))
          if (positions.length > 0) return Math.min(...positions)
        }
      } else {
        if (bandlinkPlaylist.track_position != null && !isNaN(bandlinkPlaylist.track_position)) {
          return bandlinkPlaylist.track_position
        }
        if (bandlinkPlaylist.tracks_info && bandlinkPlaylist.tracks_info.length > 0) {
          const positions = bandlinkPlaylist.tracks_info
            .map((t: any) => t.position)
            .filter((p: number) => p != null && !isNaN(p) && isFinite(p))
          if (positions.length > 0) return Math.min(...positions)
        }
      }
      return null
    }

    const trackPosition = getTrackPosition()

    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return ""
      try {
        return new Date(dateString).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      } catch {
        return dateString
      }
    }

    const displayDate = isVK
      ? formatDate(vkPlaylist.added_at || vkPlaylist.parsed_at)
      : formatDate(bandlinkPlaylist.added_at || bandlinkPlaylist.parsed_at)

    const tracksInfo = isVK ? vkPlaylist.tracks_info || [] : bandlinkPlaylist.tracks_info || []
    const artistReleases = tracksInfo
      .map((t: any) => t.title || t.releaseName)
      .filter((name: string, index: number, arr: string[]) => name && arr.indexOf(name) === index)
    const releaseNames = isVK
      ? vkPlaylist.track_names || artistReleases.join(", ")
      : bandlinkPlaylist.track_names || artistReleases.join(", ")

    const trackLine =
      tracksCount > 0
        ? `${tracksCount} ${tracksCount === 1 ? "трек" : tracksCount < 5 ? "трека" : "треков"}`
        : "Треки"
    const metaLine = [displayDate, trackPosition != null && !isNaN(trackPosition) ? `${trackPosition} место` : null]
      .filter(Boolean)
      .join(" · ")

    return (
      <div className="playlist-card group relative aspect-square rounded-2xl overflow-hidden card-glass">
        <div className="absolute inset-0 z-0">
          <Image
            src={coverUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 ease-out filter brightness-[0.8] grayscale-[20%] playlist-cover-img"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        </div>
        <a
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-[5]"
          aria-label="Открыть плейлист"
        />

        <div className="playlist-overlay absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 flex flex-col justify-between p-5 z-10 pointer-events-none">
          <div className="flex justify-between items-start gap-2 pointer-events-auto">
            <span className="platform-badge rounded px-2 py-1 text-[10px] uppercase font-bold text-white tracking-wider flex items-center gap-1 max-w-[70%]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
              <span className="truncate">{platformName}</span>
            </span>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openAssignModal(playlist.id, title, type)
                }}
                className="p-1.5 rounded-full bg-primary/90 hover:bg-primary text-black transition-colors"
                title="Привязать к артисту"
              >
                <span className="material-symbols-outlined text-lg leading-none">person_add</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDeleteTarget({ id: playlist.id, type })
                }}
                className="p-1.5 rounded-full bg-destructive/90 hover:bg-destructive text-white transition-colors"
                title="Удалить плейлист"
              >
                <span className="material-symbols-outlined text-lg leading-none">delete</span>
              </button>
            </div>
          </div>

          <div className="self-center pointer-events-auto">
            <a
              href={playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md transition-colors hover:border-primary hover:bg-primary group/play"
              onClick={(e) => e.stopPropagation()}
              aria-label="Открыть плейлист в новой вкладке"
            >
              <span className="material-symbols-outlined text-lg leading-none text-white group-hover/play:text-black">
                open_in_new
              </span>
            </a>
          </div>

          <div className="pointer-events-none">
            <h3 className="font-bold text-white text-lg leading-tight mb-1 line-clamp-2">{title}</h3>
            <p className="text-xs text-gray-400 font-mono line-clamp-1">{artistName}</p>
            <p className="text-xs text-gray-500 font-mono mt-1 line-clamp-1">
              {trackLine} {metaLine ? `· ${metaLine}` : ""}
            </p>
            {releaseNames && releaseNames.trim() ? (
              <p className="text-[10px] text-gray-500 font-mono mt-2 line-clamp-2 leading-relaxed">Релизы: {releaseNames}</p>
            ) : null}
          </div>
        </div>

        <div className="playlist-default-footer absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-[5] pointer-events-none transition-opacity duration-300">
          <h3 className="font-bold text-white text-lg truncate">{title}</h3>
          <p className="text-xs text-gray-400 font-mono mt-1 line-clamp-2 min-h-[2.5rem]">
            {platformName} · {releaseNames?.trim() ? releaseNames : artistName}
          </p>
        </div>
      </div>
    )
  }

  const totalPlaylistsCount =
    vkPlaylists.length +
    yandexPlaylists.length +
    mtsPlaylists.length +
    sberPlaylists.length +
    okPlaylists.length +
    otherPlaylists.length

  return (
    <>
    <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pb-24 space-y-8">
        {actionBanner && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
              actionBanner.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
            role="status"
          >
            <span className="material-symbols-outlined flex-shrink-0">
              {actionBanner.type === "ok" ? "check_circle" : "error"}
            </span>
            {actionBanner.text}
            <button
              type="button"
              onClick={() => setActionBanner(null)}
              className="ml-auto text-gray-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              aria-label="Закрыть"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}
        <div className="space-y-4 mb-2">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest flex-wrap gap-x-2 gap-y-1">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Плейлисты</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white uppercase tracking-tight mb-2">
              Плейлисты
            </h1>
            <p className="text-sm text-gray-400 font-light max-w-lg">
              Управление плейлистами из VK, МТС Музыки, Яндекс Музыки и других площадок (SFTP).
            </p>
          </div>
        </div>

        <Tabs defaultValue="playlists" className="space-y-8">
          <TabsList className="flex flex-wrap gap-2 h-auto p-0 bg-transparent w-full justify-start">
            <TabsTrigger
              value="playlists"
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 data-[state=active]:border-primary/40 data-[state=active]:text-primary data-[state=active]:bg-primary/10 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">queue_music</span>
              По платформам
            </TabsTrigger>
            <TabsTrigger
              value="by-artists"
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 data-[state=active]:border-primary/40 data-[state=active]:text-primary data-[state=active]:bg-primary/10 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">groups</span>
              По артистам
            </TabsTrigger>
            <TabsTrigger
              value="parsing"
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 data-[state=active]:border-primary/40 data-[state=active]:text-primary data-[state=active]:bg-primary/10 inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">settings</span>
              Парсинг (резерв)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playlists" className="space-y-8">
            <div className="card-glass rounded-2xl border border-white/5 p-4 md:p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex flex-wrap items-center gap-4">
                <span className="material-symbols-outlined text-primary text-xl">filter_alt</span>
                <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Фильтр</span>
                <Input
                  placeholder="Поиск плейлиста или артиста…"
                  value={playlistQuery}
                  onChange={(e) => handlePlaylistSearch(e.target.value)}
                  className={`max-w-xs ${inputCls} h-10`}
                />
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500 ml-auto">
                  Показано {vkResults.length + bandlinkResults.length} из {playlistTotal}
                </p>
                <Select value={selectedArtistFilter} onValueChange={setSelectedArtistFilter}>
                  <SelectTrigger className={`w-64 ${inputCls} h-10`}>
                    <SelectValue placeholder="Все артисты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все артисты</SelectItem>
                    {getUniqueArtists().map((artist) => (
                      <SelectItem key={artist} value={artist}>
                        {artist}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="material-symbols-outlined text-accent-azure text-xl">sort</span>
                <span className="text-xs font-mono uppercase tracking-widest text-gray-500">Сортировка</span>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as "added_at" | "parsed_at")}>
                  <SelectTrigger className={`w-48 ${inputCls} h-10`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="added_at">По дате добавления</SelectItem>
                    <SelectItem value="parsed_at">По дате парсинга</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as "asc" | "desc")}>
                  <SelectTrigger className={`w-40 ${inputCls} h-10`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Сначала новые</SelectItem>
                    <SelectItem value="asc">Сначала старые</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-xs text-gray-500 font-mono ml-auto">
                  Показано: <span className="text-white font-semibold">{totalPlaylistsCount}</span> плейлистов
                </div>
              </div>
            </div>

            {/* VK Музыка */}
            {vkPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <img 
                      src="/images/dsp-icons/vk-music.png" 
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      src="/images/dsp-icons/yandex-music.svg" 
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      src="/images/dsp-icons/mts-music.svg" 
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      src="/images/dsp-icons/sber-music.svg" 
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {okPlaylists.map((playlist) => (
                    <PlaylistCard key={`ok-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                </div>
              </div>
            )}

            {otherPlaylists.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg px-4 py-3">
                  <div className="rounded-lg p-2">
                    <span className="material-symbols-outlined text-2xl text-gray-400">library_music</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Другие площадки</h2>
                  <Badge className="border-0 bg-white/15 text-gray-200">{otherPlaylists.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {otherPlaylists.map((playlist) => (
                    <PlaylistCard key={`other-${playlist.id}`} playlist={playlist} type="bandlink" />
                  ))}
                </div>
              </div>
            )}

            {vkPlaylists.length === 0 && yandexPlaylists.length === 0 && mtsPlaylists.length === 0 && sberPlaylists.length === 0 && okPlaylists.length === 0 && otherPlaylists.length === 0 && (
              <div className="card-glass rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center py-16 px-4">
                <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 opacity-30">queue_music</span>
                <h3 className="text-xl font-bold text-white mb-2">Нет плейлистов</h3>
                <p className="text-gray-400 mb-6 text-center max-w-md text-sm">
                  {selectedArtistFilter === "all"
                    ? "Запустите парсинг для получения плейлистов"
                    : `Нет плейлистов для артиста «${selectedArtistFilter}»`}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const tab = document.querySelector('[value="parsing"]') as HTMLElement
                    tab?.click()
                  }}
                  className="border border-white/10 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 hover:text-primary inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  Перейти к парсингу
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="by-artists" className="space-y-8">
            {/* Группировка плейлистов по артистам. VK только из vkResults; Bandlink — всё кроме VK (чтобы не дублировать). */}
            {getUniqueArtists().map(artistName => {
              const artist = artists.find(a => a.name === artistName)
              const artistVKPlaylists = vkResults.filter(p => p.artist_name === artistName)
              const artistBandlinkPlaylists = bandlinkResults.filter(
                (p) => p.artist_name === artistName && !isVkMusicPlatform(p.platform)
              )
              const totalPlaylists = artistVKPlaylists.length + artistBandlinkPlaylists.length

              if (totalPlaylists === 0) return null

              return (
                <div key={artistName} className="space-y-4">
                  {/* Заголовок артиста */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 card-glass rounded-2xl border border-white/5 p-4 md:p-6 hover:border-primary/20 transition-colors">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center text-2xl font-display font-bold text-primary shrink-0">
                      {artist?.name?.charAt(0) || artistName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-white tracking-wide">{artistName}</h2>
                      <p className="text-sm text-gray-500 font-mono mt-1">
                        {totalPlaylists}{" "}
                        {totalPlaylists === 1 ? "плейлист" : totalPlaylists < 5 ? "плейлиста" : "плейлистов"}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              <div className="card-glass rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center py-16 px-4">
                <span className="material-symbols-outlined text-5xl text-gray-600 mb-4 opacity-30">groups</span>
                <h3 className="text-xl font-bold text-white mb-2">Нет артистов</h3>
                <p className="text-gray-400 mb-6 text-center max-w-md text-sm">Запустите парсинг для получения плейлистов</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    const tab = document.querySelector('[value="parsing"]') as HTMLElement
                    tab?.click()
                  }}
                  className="border border-white/10 rounded-lg px-4 py-2 text-xs font-mono uppercase tracking-widest text-gray-500 hover:text-primary inline-flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  Перейти к парсингу
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="parsing" className="space-y-8">
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent-azure/50 to-transparent" />
              <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-4">
                <span className="w-1.5 h-6 rounded-full bg-accent-azure shrink-0" />
                <span className="material-symbols-outlined text-accent-azure text-2xl">sync</span>
                Синхронизация SFTP
              </h2>
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                  <span className="material-symbols-outlined text-primary align-middle mr-2 text-lg">info</span>
                  По умолчанию плейлисты синхронизируются с SFTP сервером автоматически в 16:00 и 00:30 ежедневно. Система
                  подключается к SFTP серверу, скачивает CSV файлы и парсит их автоматически.
                  {sftpHints && (
                    <span className="block mt-2 font-mono text-[11px] text-gray-500">
                      Ожидаемый хост: {sftpHints.host} · каталог: {sftpHints.remotePath}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-500">Импорт по шагам</p>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">Локальный CSV</label>
                      {sftpLocalFiles.length === 0 ? (
                        <div
                          className={`${inputCls} flex items-center text-gray-500 text-sm cursor-not-allowed opacity-80`}
                        >
                          Нет файлов в sftp_downloads — скачайте с SFTP или загрузите CSV
                        </div>
                      ) : (
                        <Select value={selectedSftpCsv} onValueChange={setSelectedSftpCsv} disabled={sftpToolsBusy}>
                          <SelectTrigger className={inputCls}>
                            <SelectValue placeholder="Выберите файл" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 border border-white/10 bg-[#141414] text-white">
                            {sftpLocalFiles.map((f) => (
                              <SelectItem key={f.name} value={f.name} className="font-mono text-xs">
                                {f.name} · {f.dataRows} строк · {new Date(f.mtimeISO).toLocaleString("ru-RU")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sftpToolsBusy}
                      onClick={() => void loadSftpLocalCsvList()}
                      className="border-white/10 text-gray-400 hover:text-primary font-mono text-xs uppercase tracking-widest shrink-0"
                    >
                      Обновить список
                    </Button>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      id="sftp-cleanup"
                      checked={sftpCleanupRemoved}
                      onCheckedChange={(c) => setSftpCleanupRemoved(c === true)}
                      disabled={sftpToolsBusy}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-gray-400 leading-snug">
                      <span className="text-white font-medium group-hover:text-primary transition-colors">
                        Удалять из БД плейлисты, которых нет в выбранном CSV
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        По умолчанию выключено: пустой или чужой файл не сотрёт каталог. Включайте только если CSV — полный снимок дистрибуции.
                      </span>
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sftpToolsBusy || isSftpSyncing}
                      onClick={() => void runSftpDownloadNew()}
                      className="border-white/10 text-gray-300 hover:text-primary font-mono text-xs uppercase tracking-wider"
                    >
                      <span className="material-symbols-outlined text-base mr-1 align-middle">download</span>
                      Скачать новые с SFTP
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sftpToolsBusy || isSftpSyncing}
                      onClick={() => void runSftpDownloadLatest()}
                      className="border-white/10 text-gray-300 hover:text-primary font-mono text-xs uppercase tracking-wider"
                    >
                      <span className="material-symbols-outlined text-base mr-1 align-middle">cloud_download</span>
                      Скачать последний CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={sftpToolsBusy || isSftpSyncing || !selectedSftpCsv}
                      onClick={() => void runSftpApplySelected()}
                      className="border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-wider sm:col-span-2"
                    >
                      <span className="material-symbols-outlined text-base mr-1 align-middle">database_upload</span>
                      Применить выбранный CSV к базе
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      id="sftp-csv-upload"
                      onChange={(e) => void onSftpCsvUpload(e)}
                      disabled={sftpToolsBusy || isSftpSyncing}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sftpToolsBusy || isSftpSyncing}
                      className="border-white/10 text-gray-400 hover:text-white font-mono text-xs uppercase tracking-widest"
                      onClick={() => document.getElementById("sftp-csv-upload")?.click()}
                    >
                      <span className="material-symbols-outlined text-base mr-1 align-middle">upload_file</span>
                      Загрузить CSV с компьютера
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => setSftpConfirmOpen(true)}
                  disabled={isSftpSyncing}
                  className="w-full rounded-lg bg-primary text-black hover:bg-emerald-400 font-bold inline-flex items-center justify-center gap-2"
                >
                  {isSftpSyncing ? (
                    <>
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                      Синхронизация...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">play_arrow</span>
                      Запустить синхронизацию SFTP
                    </>
                  )}
                </Button>
                {parsingOutput && (
                  <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/20">
                    <div className="text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-gray-300">
                      {parsingOutput}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="space-y-6">
                  {/* Первая строка: Выбор артистов и Парсинг */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Поиск и выбор артистов */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">groups</span>
                <h3 className="text-lg font-bold text-white tracking-wide">Выбор артистов</h3>
              </div>
              
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">
                  search
                </span>
                <Input
                  placeholder="Поиск артистов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-10 ${inputCls}`}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllRecentArtists}
                  disabled={recentArtists.length === 0}
                  className="flex items-center gap-1 border border-white/10 text-gray-400 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">schedule</span>
                  Недавние ({recentArtists.length})
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearSelection}
                  disabled={selectedArtists.length === 0}
                  className="border border-white/10 text-gray-400 hover:text-primary"
                >
                  Очистить
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
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

              <div className="text-xs text-gray-500 font-mono rounded-lg border border-white/10 bg-white/[0.02] p-2">
                Выбрано: <span className="font-semibold text-white">{selectedArtists.length}</span> артистов
              </div>
            </div>

            {/* Запуск парсинга */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">sync</span>
                <h3 className="text-lg font-bold text-white tracking-wide">Парсинг</h3>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={runVKParser}
                  disabled={isParsingVK || selectedArtists.length === 0}
                  className="w-full h-12 text-sm font-semibold rounded-lg bg-primary text-black hover:bg-emerald-400"
                  size="lg"
                >
                  {isParsingVK ? (
                    <>
                      <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
                      Парсинг VK...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined mr-2">queue_music</span>
                      Парсить VK
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={runBandlinkParser}
                  disabled={isParsingBandlink || selectedArtists.length === 0}
                  variant="secondary"
                  className="w-full h-12 text-sm font-medium border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  size="lg"
                >
                  {isParsingBandlink ? (
                    <>
                      <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
                      Парсинг Bandlink...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined mr-2">travel_explore</span>
                      Парсить Bandlink
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => setClearResultsOpen(true)}
                  variant="destructive"
                  size="sm"
                  className="w-full border-destructive/50"
                >
                  <span className="material-symbols-outlined mr-2 text-lg">delete</span>
                  Очистить результаты
                </Button>
              </div>
            </div>

                  </div>

                  {/* Вторая строка: История парсинга */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">history</span>
                        <h3 className="text-lg font-bold text-white tracking-wide">История парсинга</h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadParsingHistory}
                        disabled={isLoadingHistory}
                        className="text-gray-400 hover:text-primary"
                      >
                        <span className={`material-symbols-outlined text-lg ${isLoadingHistory ? "animate-spin" : ""}`}>sync</span>
                      </Button>
                    </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 min-h-[200px] max-h-[400px] overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full py-12">
                    <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
                  </div>
                ) : parsingHistory.length > 0 ? (
                  <div className="space-y-3">
                    {parsingHistory.map((item, index) => (
                      <div key={index} className="border border-white/10 rounded-xl p-3 space-y-2 bg-white/[0.02]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={item.parser_type === 'bandlink' ? 'default' : 'secondary'} className="text-xs">
                            {item.parser_type === 'bandlink' ? 'Bandlink' : 'VK'}
                          </Badge>
                          {item.status === 'completed' ? (
                            <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
                          ) : item.status === 'failed' ? (
                            <span className="material-symbols-outlined text-lg text-destructive">cancel</span>
                          ) : (
                            <span className="material-symbols-outlined text-lg text-accent-azure animate-spin">progress_activity</span>
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
                              <span className="material-symbols-outlined text-sm text-destructive">error</span>
                              <span className="font-medium text-destructive">Ошибки:</span>
                            </div>
                            <pre className="text-red-400 whitespace-pre-wrap text-xs">{item.errors}</pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 py-12">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-4xl mx-auto mb-2 opacity-40 block">schedule</span>
                      <p className="text-sm font-mono">История парсинга пуста</p>
                      <p className="text-xs mt-1 text-gray-600">Запустите парсинг, чтобы увидеть историю</p>
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
                <span className="material-symbols-outlined text-primary text-xl">cookie</span>
                <h3 className="text-lg font-bold text-white tracking-wide">Cookies Bandlink</h3>
              </div>
              
              <Textarea
                placeholder={`Вставьте cookies для Bandlink в формате строки (каждая строка: name=value):\n_yascZbPBpGejBI8wyUctjcuMZQX8ThOZfHYB5DN8GWR3zkzmGIuIN9V4/Lu9t62ssa13vA==\n_ym_d1768914125\n...`}
                value={cookiesInput}
                onChange={(e) => setCookiesInput(e.target.value)}
                className="min-h-[120px] font-mono text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 placeholder:text-gray-600"
              />
              
              <Button
                onClick={updateCookies}
                disabled={isUpdatingCookies || !cookiesInput.trim()}
                size="sm"
                className="w-full rounded-lg bg-primary text-black hover:bg-emerald-400 font-semibold"
              >
                {isUpdatingCookies ? (
                  <>
                    <span className="material-symbols-outlined mr-2 animate-spin text-lg">progress_activity</span>
                    Обновление...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined mr-2 text-lg">save</span>
                    Обновить Cookies
                  </>
                )}
              </Button>
              
              {cookiesStatus && (
                <Alert variant={cookiesStatus.type}>
                  <AlertDescription>{cookiesStatus.message}</AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-gray-500 font-mono rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <p>Последнее обновление:</p>
                <p className="text-gray-300">{lastCookiesUpdate || "Не обновлялись"}</p>
              </div>
            </div>

            {/* Управление Cookies VK */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">cookie</span>
                <h3 className="text-lg font-bold text-white tracking-wide">Cookies VK</h3>
              </div>
              
              <Textarea
                placeholder={`Вставьте cookies для VK в формате строки (каждая строка: name=value):\nadblock1\ndomain_sidw3y9a5vc6Kz6rEXNpmFZX%3A1768866028820\nhttokenjzx5WH7NpAcA8fnDeklUB6xDpwlgX4bAGyi5jYNGT3JsF-q-K7ACAWN3IXZXjmJgIBzPumtgTSgGud6x72Oy5EhMpk9kajtz_W3WaSDbQwXUjzV9HLoIEj5KZG8v5hbFK1k\n...`}
                value={vkCookiesInput}
                onChange={(e) => setVkCookiesInput(e.target.value)}
                className="min-h-[120px] font-mono text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 placeholder:text-gray-600"
              />
              
              <Button
                onClick={updateVkCookies}
                disabled={isUpdatingVkCookies || !vkCookiesInput.trim()}
                size="sm"
                className="w-full rounded-lg bg-primary text-black hover:bg-emerald-400 font-semibold"
              >
                {isUpdatingVkCookies ? (
                  <>
                    <span className="material-symbols-outlined mr-2 animate-spin text-lg">progress_activity</span>
                    Обновление...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined mr-2 text-lg">save</span>
                    Обновить Cookies
                  </>
                )}
              </Button>
              
              {vkCookiesStatus && (
                <Alert variant={vkCookiesStatus.type}>
                  <AlertDescription>{vkCookiesStatus.message}</AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-gray-500 font-mono rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <p>Последнее обновление:</p>
                <p className="text-gray-300">{lastVkCookiesUpdate || "Не обновлялись"}</p>
              </div>
            </div>
                  </div>
                </div>
            </div>
    </TabsContent>

    </Tabs>

        <footer className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block animate-pulse" />
            System Operational
          </div>
          <div className="text-gray-400 uppercase tracking-widest">
            TOTAL FOUND:{" "}
            <span className="text-white font-bold">{vkResults.length + bandlinkResults.length}</span> PLAYLISTS
          </div>
          <span className="sm:text-right">ROSSEL LABEL ENGINE V2.4 | ADMIN</span>
        </footer>
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
                  <SelectTrigger className={`${inputCls} h-10`}>
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
                      <span className="material-symbols-outlined mr-2 animate-spin">progress_activity</span>
                      Привязка...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined mr-2">person_add</span>
                      Привязать
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={sftpConfirmOpen} onOpenChange={setSftpConfirmOpen}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Синхронизация SFTP</DialogTitle>
            <DialogDescription className="text-gray-400">
              Скачает только новые CSV с SFTP и применит к базе последний непустой файл из папки sftp_downloads. Учитывается галочка «Удалять из БД…» на странице. Операция может занять несколько минут.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setSftpConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-primary text-black hover:bg-primary/90"
              onClick={() => {
                setSftpConfirmOpen(false)
                void runManualParser()
              }}
            >
              Запустить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearResultsOpen} onOpenChange={setClearResultsOpen}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase text-red-400">Очистка</DialogTitle>
            <DialogDescription className="text-gray-400">
              Очистить все результаты парсинга в базе? Это действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setClearResultsOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={() => void clearResultsConfirmed()}
            >
              Очистить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-[#0f0f0f] border border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase">Удалить плейлист</DialogTitle>
            <DialogDescription className="text-gray-400">Удалить эту запись из базы?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="border-white/20" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Отмена
            </Button>
            <Button
              type="button"
              className="bg-primary text-black hover:bg-primary/90"
              onClick={() => void performDeletePlaylist()}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
