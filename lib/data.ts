// Types
export type UserRole = "artist" | "admin"

export interface User {
  id: string
  username: string
  password: string
  role: UserRole
  name: string
  email?: string
  avatarUrl?: string
  vkMusicUrl?: string // Ссылка на профиль в ВК Музыке
  yandexMusicUrl?: string // Ссылка на профиль в Яндекс Музыке
  spotifyUrl?: string // Ссылка на профиль в Spotify (добавим для полноты)
}

export type ReleaseStatus = "released" | "moderation" | "delivery" | "scheduled"

export interface Release {
  id: string
  artistId: string
  title: string
  coverUrl: string
  upc: string
  releaseDate: string
  status: ReleaseStatus
  tracks: Track[]
}

export interface Track {
  id: string
  title: string
  isrc?: string
  duration: string
}

export interface Report {
  id: string
  artistId: string
  quarter: string
  year: number
  fileUrl: string
  uploadDate: string
  status?: "pending" | "processed" // Статус обработки отчета
  generatedDate?: string // Дата генерации отчета
  fileName?: string // Имя файла отчета
  artistName?: string // Имя артиста (для незарегистрированных)
  isRegistered?: boolean // Флаг регистрации артиста в системе
  totalPlays?: number // Общее количество прослушиваний
  totalAmount?: number // Общая сумма
}

export interface Payment {
  id: string
  artistId: string
  amount: number
  quarter: string
  year: number
  date: string
  status: "pending" | "completed"
}

export interface Playlist {
  id: string
  name: string
  platform: string
  imageUrl: string
  trackId: string
  artistId: string
  addedDate: string
  description: string
  externalUrl?: string // Добавляем ссылку на внешний ресурс
}

// Функция для получения всех пользователей (включая динамических)
export function getAllUsers(): User[] {
  // Получаем пользователей из статического массива
  const staticUsers = users
  
  // Получаем пользователей из localStorage (если есть)
  try {
    if (typeof window !== 'undefined') {
      const dynamicUsersStr = localStorage.getItem("dynamicUsers")
      const dynamicUsers = dynamicUsersStr ? JSON.parse(dynamicUsersStr) : []
      
      return [...staticUsers, ...dynamicUsers]
    }
    return staticUsers
  } catch (error) {
    console.error("Error getting users from localStorage:", error)
    return staticUsers
  }
}

// Mock data - оставляем только тестового артиста и админа
export const users: User[] = [
  {
    id: "1",
    username: "artist1",
    password: "password123",
    role: "artist",
    name: "Артист Первый",
    email: "artist1@example.com",
    avatarUrl: "/artists/artist1/avatar.jpg",
    vkMusicUrl: "https://vk.com/artist/skaya", // Используем реальный URL для тестирования
    yandexMusicUrl: "https://music.yandex.ru/artist/artist1",
    spotifyUrl: "https://open.spotify.com/artist/artist1",
  },
  {
    id: "2",
    username: "admin",
    password: "admin123",
    role: "admin",
    name: "Администратор",
    email: "admin@rossel66.com",
  },
  // Оставляем только СКАЯ для тестирования парсера
  {
    id: "25",
    username: "skaya",
    password: "skaya9451",
    role: "artist",
    name: "СКАЯ",
    vkMusicUrl: "https://vk.com/artist/skaya",
  },
]

// Пустой массив отчетов
export const reports: Report[] = []

// Релизы только для тестового артиста
export const releases: Release[] = [
  {
    id: "1",
    artistId: "1",
    title: "Новый Альбом",
    coverUrl: "/artists/artist1/covers/album1.jpg",
    upc: "123456789012",
    releaseDate: "2023-12-15",
    status: "released",
    tracks: [
      { id: "t1", title: "Трек 1", isrc: "ISRC123456789", duration: "3:45" },
      { id: "t2", title: "Трек 2", isrc: "ISRC123456790", duration: "4:12" },
    ],
  },
  {
    id: "2",
    artistId: "1",
    title: "Сингл",
    coverUrl: "/artists/artist1/covers/single1.jpg",
    upc: "123456789013",
    releaseDate: "2024-02-01",
    status: "moderation",
    tracks: [{ id: "t3", title: "Новый Трек", isrc: "ISRC123456791", duration: "3:21" }],
  },
]

// Платежи только для тестового артиста
export const payments: Payment[] = [
  {
    id: "p1",
    artistId: "1",
    amount: 12500,
    quarter: "Q1",
    year: 2023,
    date: "2023-04-20",
    status: "completed",
  },
  {
    id: "p2",
    artistId: "1",
    amount: 18750,
    quarter: "Q2",
    year: 2023,
    date: "2023-07-20",
    status: "completed",
  },
]

// Плейлисты только для тестового артиста
export const playlists: Playlist[] = [
  {
    id: "pl1",
    name: "Новинки Недели",
    platform: "Яндекс Музыка",
    imageUrl: "/playlists/yandex_new.png",
    trackId: "t1",
    artistId: "1",
    addedDate: "2023-12-20",
    description: "Попал в систему рекомендаций Яндекс Музыки",
    externalUrl: "https://music.yandex.ru/playlist/1234",
  },
  {
    id: "pl2",
    name: "Инди Открытия",
    platform: "Spotify",
    imageUrl: "/playlists/spotify_indie.png",
    trackId: "t2",
    artistId: "1",
    addedDate: "2024-01-05",
    description: "Попал в еженедельную подборку Spotify",
    externalUrl: "https://open.spotify.com/playlist/5678",
  },
]

// Helper functions
export function getArtistReleases(artistId: string): Release[] {
  // Получаем релизы из статического массива
  const staticReleases = releases.filter((release) => release.artistId === artistId)
  
  // Получаем релизы из localStorage (если есть)
  try {
    if (typeof window !== 'undefined') {
      const dynamicReleasesStr = localStorage.getItem("dynamicReleases")
      const dynamicReleases = dynamicReleasesStr 
        ? JSON.parse(dynamicReleasesStr).filter((release: Release) => release.artistId === artistId)
        : []
      
      return [...staticReleases, ...dynamicReleases]
    }
    return staticReleases
  } catch (error) {
    console.error("Error getting releases from localStorage:", error)
    return staticReleases
  }
}

// Функция для получения всех релизов
export function getAllReleases(): Release[] {
  // Получаем релизы из статического массива
  const staticReleases = releases
  
  // Получаем релизы из localStorage (если есть)
  try {
    if (typeof window !== 'undefined') {
      const dynamicReleasesStr = localStorage.getItem("dynamicReleases")
      const dynamicReleases = dynamicReleasesStr ? JSON.parse(dynamicReleasesStr) : []
      
      return [...staticReleases, ...dynamicReleases]
    }
    return staticReleases
  } catch (error) {
    console.error("Error getting releases from localStorage:", error)
    return staticReleases
  }
}

export function getArtistReports(artistId: string): Report[] {
  return reports.filter((report) => report.artistId === artistId)
}

export function getArtistPayments(artistId: string): Payment[] {
  return payments.filter((payment) => payment.artistId === artistId)
}

export function getArtistPlaylists(artistId: string): Playlist[] {
  // Получаем плейлисты из статического массива
  const staticPlaylists = playlists.filter((playlist) => playlist.artistId === artistId)

  // Получаем плейлисты из localStorage (если есть)
  try {
    const playlistsStr = localStorage.getItem("playlists")
    const dynamicPlaylists = playlistsStr
      ? JSON.parse(playlistsStr).filter((playlist: Playlist) => playlist.artistId === artistId)
      : []

    return [...staticPlaylists, ...dynamicPlaylists]
  } catch (error) {
    console.error("Error getting playlists from localStorage:", error)
    return staticPlaylists
  }
}

export function getTotalEarnings(artistId: string): number {
  return getArtistPayments(artistId).reduce((total, payment) => total + payment.amount, 0)
}

export function getTrackById(trackId: string): { track: Track; release: Release } | null {
  for (const release of releases) {
    const track = release.tracks.find((t) => t.id === trackId)
    if (track) {
      return { track, release }
    }
  }
  return null
}

export function getPlaylistsForTrack(trackId: string): Playlist[] {
  return playlists.filter((playlist) => playlist.trackId === trackId)
}

// Function to generate Excel data for an artist
export function generateArtistExcelData(artistId: string): any[] {
  const artistReleases = getArtistReleases(artistId)
  const artist = users.find((user) => user.id === artistId)

  if (!artist) return []

  const excelData: any[] = []

  artistReleases.forEach((release) => {
    release.tracks.forEach((track) => {
      excelData.push({
        "Никнейм артиста": artist.name,
        "Название релиза": release.title,
        "Название трека": track.title,
        Дата: new Date(release.releaseDate).toLocaleDateString(),
        UPC: release.upc,
        ISRC: track.isrc || "Не присвоен",
        Длительность: track.duration,
        Статус: release.status,
      })
    })
  })

  return excelData
}

// Функция для получения отчетов по кварталу
export function getReportsByQuarter(quarter: string, year?: number): Report[] {
  if (year) {
    return reports.filter((report) => report.quarter === quarter && report.year === year)
  }
  return reports.filter((report) => report.quarter === quarter)
}

// Функция для получения всех плейлистов
export function getAllPlaylists(): Playlist[] {
  // Получаем плейлисты из статического массива
  const staticPlaylists = playlists

  // Получаем плейлисты из localStorage (если есть)
  try {
    const playlistsStr = localStorage.getItem("playlists")
    const dynamicPlaylists = playlistsStr ? JSON.parse(playlistsStr) : []

    return [...staticPlaylists, ...dynamicPlaylists]
  } catch (error) {
    console.error("Error getting playlists from localStorage:", error)
    return staticPlaylists
  }
}
