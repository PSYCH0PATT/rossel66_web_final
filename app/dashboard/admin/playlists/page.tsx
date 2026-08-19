"use client"

import { useState, useEffect, useRef, useCallback, memo } from 'react'
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
import { splitCollaboratingArtistDisplayNames } from "@/lib/split-artist-names"
import { formatDateRu } from "@/lib/format-date"
import { DashboardFooter } from "@/components/dashboard-footer"
import {
  isMtsMusicPlatform,
  isOdnoklassnikiPlatform,
  isSberMusicPlatform,
  isVkMusicPlatform,
  isYandexMusicPlatform,
  normalizePlatform,
} from "@/lib/playlist-platform"

/**
 * B3: основной артист из поля исполнителя (первый токен коллаба).
 * «Artist feat Guest» → «Artist», чтобы фит не был отдельной записью в фильтре.
 */
/** G4: как часто перепроверять системное предупреждение о cookies */

/** Единый маппинг платформы -> цвет бейджа (VK, Яндекс, МТС, Сбер и т.д.) */
function getPlatformBadgeStyle(platform: string) {
  const n = normalizePlatform(platform)
  if (n.includes("vk") || n.includes("вк")) return { bg: "#0077FF", color: "#FFFFFF" }
  if (n.includes("yandex") || n.includes("яндекс")) return { bg: "#FFCC00", color: "#000000" }
  if (n.includes("mts") || n.includes("мтс")) return { bg: "#E30611", color: "#FFFFFF" }
  if (n.includes("sber") || n.includes("сбер")) return { bg: "#21A038", color: "#FFFFFF" }
  if (n.includes("одноклассник") || n.includes("odnoklassniki")) return { bg: "#EE8208", color: "#FFFFFF" }
  return { bg: "#6b7280", color: "#FFFFFF" }
}

/** F-PARS-7: сколько плейлистов тянем за раз (максимум /api/playlists/sftp) */
const PLAYLISTS_PAGE_TAKE = 500

function primaryArtistName(name?: string | null): string {
  if (!name) return ""
  return splitCollaboratingArtistDisplayNames(name)[0] || name.trim()
}

type PlaylistCardProps = {
  playlist: VKPlaylist | BandlinkPlaylist
  type: "vk" | "bandlink"
  onAssign: (id: number, name: string, type: "vk" | "bandlink") => void
  onDelete: (target: { id: number; type: "vk" | "bandlink" }) => void
}

/**
 * F-PARS-12: карточка объявлялась ВНУТРИ рендера страницы, поэтому на каждый
 * из ~40 useState React видел новый тип компонента и полностью перемонтировал
 * все карточки вместе с <Image> — обложки перезагружались на любой чих.
 * Теперь компонент на уровне модуля и обёрнут в memo.
 */
const PlaylistCard = memo(function PlaylistCard({ playlist, type, onAssign, onDelete }: PlaylistCardProps) {
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

  // A5: даты плейлистов — календарные строки; общий хелпер форматирует их в UTC
  const formatDate = (dateString: string | undefined) => formatDateRu(dateString, "")

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
                onAssign(playlist.id, title, type)
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
                onDelete({ id: playlist.id, type })
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
})

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
  const [vkResults, setVkResults] = useState<VKPlaylist[]>([])
  const [bandlinkResults, setBandlinkResults] = useState<BandlinkPlaylist[]>([])
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
  /** G4: системное предупреждение о cookies — отдельно от результата ручного обновления */
  
  // Состояния для истории парсинга
  
  // Состояния для привязки плейлиста к артисту
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<{id: number, name: string, type: 'vk' | 'bandlink'} | null>(null)
  const [selectedArtistForAssign, setSelectedArtistForAssign] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  /** H3: подтверждение переназначения плейлиста, если он уже принадлежит другому артисту */
  const [reassignConfirm, setReassignConfirm] = useState<{ previousArtistName: string } | null>(null)
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
      void loadSftpLocalCsvList()
    }, 0)
    return () => {
      window.clearTimeout(idle)
      // F-PARS-13: таймер debounce жил после unmount → setState на размонтированном компоненте
      if (playlistDebounceRef.current) clearTimeout(playlistDebounceRef.current)
    }
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
      /**
       * F-PARS-7: фильтр по артисту работал поверх первых 100 записей.
       * Имя из CSV часто не совпадает с именем профиля, поэтому artistId
       * не находился, серверный фильтр не применялся, и при >100 плейлистах
       * фильтр молча показывал неполные данные.
       *
       * Теперь: если artistId известен — фильтруем на сервере точно; если нет —
       * сужаем выборку по подстроке имени (`q` ищет по artistName/playlistName),
       * а точное совпадение по основному артисту доделывает клиент (см. B3).
       * take поднят до максимума роута.
       */
      const params = new URLSearchParams({ take: String(PLAYLISTS_PAGE_TAKE), skip: "0" })
      const artistMatch =
        selectedArtistFilter !== "all"
          ? artists.find((a) => a.name === selectedArtistFilter)
          : undefined

      if (selectedArtistFilter !== "all" && artistMatch?.id) {
        params.set("artistId", artistMatch.id)
      }

      if (debouncedPlaylistQuery) {
        params.set("q", debouncedPlaylistQuery)
      } else if (selectedArtistFilter !== "all" && !artistMatch?.id) {
        params.set("q", selectedArtistFilter)
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

  /**
   * G4: системное предупреждение «нужны новые cookies».
   * Раньше оно писалось в тот же state, что и результат ручного обновления
   * cookies, поэтому «✅ cookies обновлены» затирало предупреждение (и наоборот),
   * а само предупреждение выставлялось один раз при загрузке и уже не снималось,
   * даже когда парсинг снова начинал работать. Теперь отдельный state + поллинг.
   */

  // Загрузка истории парсинга

  // Загрузка статуса VK cookies

  // Обновление cookies Bandlink

  // Обновление cookies VK

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
      // B3: матчим по ОСНОВНОМУ артисту, чтобы «Artist» ловил и «Artist feat Guest»
      filtered = playlists.filter(playlist => primaryArtistName(playlist.artist_name) === artistFilter)
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
    vkResults.forEach(p => artistsSet.add(primaryArtistName(p.artist_name)))
    bandlinkResults.forEach(p => artistsSet.add(primaryArtistName(p.artist_name)))
    artistsSet.delete("")
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

  // F-PARS-12: ссылка должна быть стабильной, иначе memo(PlaylistCard) не спасёт
  const openAssignModal = useCallback((id: number, name: string, type: 'vk' | 'bandlink') => {
    setSelectedPlaylist({ id, name, type })
    setSelectedArtistForAssign('')
    setAssignModalOpen(true)
  }, [])

  const assignPlaylistToArtist = async (force = false) => {
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
          ...(force ? { force: true } : {}),
        }),
      })

      const data = await response.json()

      // H3: плейлист уже принадлежит другому артисту — спрашиваем подтверждение,
      // а не забираем молча (прежний владелец теряет видимость).
      if (response.status === 409 && data.needsConfirmation) {
        setReassignConfirm({ previousArtistName: data.previousArtistName || "другой артист" })
        return
      }

      if (data.success) {
        setActionBanner({
          type: "ok",
          text: data.unchanged
            ? "Плейлист уже был привязан к этому артисту"
            : data.reassignedFrom
              ? `Плейлист переназначен с «${data.reassignedFrom}»`
              : "Плейлист привязан к артисту",
        })
        setAssignModalOpen(false)
        setReassignConfirm(null)
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


  const inputCls =
    "h-10 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"


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
                  {/* F-PARS-7: список усечён — фильтр работает поверх загруженного, честно говорим об этом */}
                  {playlistTotal > PLAYLISTS_PAGE_TAKE && (
                    <span
                      className="ml-2 text-amber-400"
                      title={`Загружены первые ${PLAYLISTS_PAGE_TAKE} записей. Уточните поиск, чтобы фильтр охватил все данные.`}
                    >
                      (усечено)
                    </span>
                  )}
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

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {vkPlaylists.map((playlist) => (
                    <PlaylistCard key={`vk-${playlist.id}`} playlist={playlist} type="vk" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {yandexPlaylists.map((playlist) => (
                    <PlaylistCard key={`yandex-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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
                
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {mtsPlaylists.map((playlist) => (
                    <PlaylistCard key={`mts-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {sberPlaylists.map((playlist) => (
                    <PlaylistCard key={`sber-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {okPlaylists.map((playlist) => (
                    <PlaylistCard key={`ok-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {otherPlaylists.map((playlist) => (
                    <PlaylistCard key={`other-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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
              const artistVKPlaylists = vkResults.filter(p => primaryArtistName(p.artist_name) === artistName)
              const artistBandlinkPlaylists = bandlinkResults.filter(
                (p) => primaryArtistName(p.artist_name) === artistName && !isVkMusicPlatform(p.platform)
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
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                    {artistVKPlaylists.map((playlist) => (
                      <PlaylistCard key={`vk-${playlist.id}`} playlist={playlist} type="vk" onAssign={openAssignModal} onDelete={setDeleteTarget} />
                    ))}
                    {artistBandlinkPlaylists.map((playlist) => (
                      <PlaylistCard key={`bandlink-${playlist.id}`} playlist={playlist} type="bandlink" onAssign={openAssignModal} onDelete={setDeleteTarget} />
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


    </Tabs>

        <DashboardFooter>
          {/* DS8: было «TOTAL FOUND: N PLAYLISTS» */}
          <div className="uppercase tracking-widest text-gray-400">
            Найдено:{" "}
            <span className="font-bold text-white">{vkResults.length + bandlinkResults.length}</span>{" "}
            {(() => {
              const n = vkResults.length + bandlinkResults.length
              const mod10 = n % 10
              const mod100 = n % 100
              if (mod10 === 1 && mod100 !== 11) return "плейлист"
              if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "плейлиста"
              return "плейлистов"
            })()}
          </div>
        </DashboardFooter>
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
                  onClick={() => assignPlaylistToArtist()}
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

      {/* H3: переназначение плейлиста забирает его у прежнего артиста — спрашиваем явно */}
      <Dialog
        open={reassignConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setReassignConfirm(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl uppercase text-amber-400">
              Переназначить плейлист
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Плейлист «{selectedPlaylist?.name}» уже привязан к артисту «
              {reassignConfirm?.previousArtistName}». Если продолжить, он перестанет
              видеть этот плейлист в своём кабинете.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignConfirm(null)} disabled={isAssigning}>
              Отмена
            </Button>
            <Button onClick={() => assignPlaylistToArtist(true)} disabled={isAssigning}>
              {isAssigning ? "Переназначение..." : "Переназначить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
