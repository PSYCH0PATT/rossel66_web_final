import { parseVkMusicArtistPage } from "./vk-parser"
import { users } from "./data"

// Флаг для включения/отключения периодического парсинга
let isScheduledCrawlingEnabled = false
let crawlingInterval: NodeJS.Timeout | null = null

// Функция для получения HTML-кода страницы
async function fetchHtml(url: string): Promise<string | null> {
  try {
    // Проверка валидности URL
    if (!url || !url.startsWith("http")) {
      console.warn(`Invalid URL: ${url}`)
      return null
    }

    console.log(`Fetching HTML from ${url}`)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      console.warn(`HTTP error! Status: ${response.status} for URL: ${url}`)
      return null
    }

    return await response.text()
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error)
    return null
  }
}

// Функция для парсинга плейлистов артиста
export async function crawlArtistPlaylists(artistId: string): Promise<void> {
  try {
    // Найти артиста
    const artist = users.find((user) => user.id === artistId)
    if (!artist || !artist.vkMusicUrl) {
      console.log(`Skipping artist ${artist?.name || artistId}: No VK Music URL`)
      return
    }

    console.log(`Crawling playlists for artist: ${artist.name} (${artist.vkMusicUrl})`)

    // Получить HTML-код страницы артиста
    const html = await fetchHtml(artist.vkMusicUrl)

    // Если не удалось получить HTML, пропускаем этого артиста
    if (!html) {
      console.log(`Could not fetch HTML for artist ${artist.name}, skipping`)
      return
    }

    // Парсить HTML и извлечь плейлисты
    const playlists = parseVkMusicArtistPage(html)

    console.log(`Found ${playlists.length} playlists for ${artist.name}`)

    if (playlists.length === 0) {
      return
    }

    // Сохранить плейлисты в localStorage (или в базу данных в реальном приложении)
    let existingPlaylists = []
    try {
      const playlistsStr = localStorage.getItem("playlists")
      existingPlaylists = playlistsStr ? JSON.parse(playlistsStr) : []
    } catch (error) {
      console.error("Error parsing playlists from localStorage:", error)
      existingPlaylists = []
    }

    // Удалить старые плейлисты этого артиста из VK Music
    const filteredPlaylists = existingPlaylists.filter(
      (p: any) =>
        !(p.artistId === artistId && p.platform === "VK Музыка" && p.externalUrl && p.externalUrl.includes("vk.com")),
    )

    // Добавить новые плейлисты
    const newPlaylists = playlists.map((playlist, index) => ({
      id: `pl_vk_${Date.now()}_${index}`,
      name: playlist.name,
      platform: "VK Музыка",
      imageUrl: playlist.imageUrl,
      trackId: "", // Пустой trackId
      artistId,
      addedDate: new Date().toISOString().split("T")[0],
      description: "Плейлист из ВК Музыки (автоматически добавлен)",
      externalUrl: playlist.playlistUrl,
    }))

    const updatedPlaylists = [...filteredPlaylists, ...newPlaylists]

    try {
      localStorage.setItem("playlists", JSON.stringify(updatedPlaylists))
      console.log(`Successfully updated ${newPlaylists.length} playlists for ${artist.name}`)
    } catch (error) {
      console.error("Error saving playlists to localStorage:", error)
    }
  } catch (error) {
    console.error(`Error crawling playlists for artist ${artistId}:`, error)
  }
}

// Функция для парсинга плейлистов всех артистов
export async function crawlAllArtistsPlaylists(): Promise<void> {
  console.log("Starting playlist crawling for all artists...")

  // Получить всех артистов с URL VK Music
  const artistsWithVkMusic = users.filter((user) => user.role === "artist" && user.vkMusicUrl)
  console.log(`Found ${artistsWithVkMusic.length} artists with VK Music URLs`)

  // Для каждого артиста выполнить парсинг плейлистов
  for (const artist of artistsWithVkMusic) {
    try {
      await crawlArtistPlaylists(artist.id)
    } catch (error) {
      console.error(`Error processing artist ${artist.name} (ID: ${artist.id}):`, error)
      // Продолжаем с следующим артистом
    }

    // Добавляем небольшую задержку, чтобы не перегружать сервер VK
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log("Playlist crawling completed")
}

// Функция для запуска периодического парсинга
export function startScheduledCrawling(intervalHours = 3): void {
  if (isScheduledCrawlingEnabled) return

  console.log(`Scheduled playlist crawling enabled, interval: ${intervalHours} hours`)
  isScheduledCrawlingEnabled = true

  // Запустить периодический парсинг
  const intervalMs = intervalHours * 60 * 60 * 1000

  // Очищаем предыдущий интервал, если он был
  if (crawlingInterval) {
    clearInterval(crawlingInterval)
  }

  // Запускаем парсинг сразу при старте
  crawlAllArtistsPlaylists()

  // Устанавливаем интервал для периодического парсинга
  crawlingInterval = setInterval(() => {
    crawlAllArtistsPlaylists()
  }, intervalMs)
}

// Функция для остановки периодического парсинга
export function stopScheduledCrawling(): void {
  console.log("Scheduled playlist crawling disabled")
  isScheduledCrawlingEnabled = false

  if (crawlingInterval) {
    clearInterval(crawlingInterval)
    crawlingInterval = null
  }
}

// Функция для проверки статуса периодического парсинга
export function isScheduledCrawlingActive(): boolean {
  return isScheduledCrawlingEnabled
}
