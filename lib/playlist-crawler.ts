import { parseVkMusicArtistPage } from "./vk-parser"
import { prisma } from "./prisma"

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

function persistPlaylistsJson(artistId: string, artistName: string, playlists: ReturnType<typeof parseVkMusicArtistPage>): void {
  if (typeof window === "undefined") {
    console.log(
      `[playlist-crawler] Skipping localStorage (SSR): would store ${playlists.length} playlists for ${artistName} (${artistId})`
    )
    return
  }
  try {
    const playlistsStr = localStorage.getItem("playlists")
    const existingPlaylists = playlistsStr ? JSON.parse(playlistsStr) : []

    const newPlaylists = playlists.map((playlist, index) => ({
      id: `pl_vk_${Date.now()}_${index}`,
      name: playlist.name,
      platform: "VK Музыка",
      imageUrl: playlist.imageUrl,
      trackId: "",
      artistId,
      addedDate: new Date().toISOString().split("T")[0],
      description: "Плейлист из ВК Музыки (автоматически добавлен)",
      externalUrl: playlist.playlistUrl,
    }))

    const filteredPlaylists = existingPlaylists.filter(
      (p: { artistId?: string; platform?: string; externalUrl?: string }) =>
        !(p.artistId === artistId && p.platform === "VK Музыка" && p.externalUrl && p.externalUrl.includes("vk.com"))
    )

    const updatedPlaylists = [...filteredPlaylists, ...newPlaylists]
    localStorage.setItem("playlists", JSON.stringify(updatedPlaylists))
    console.log(`Successfully updated ${newPlaylists.length} playlists for ${artistName}`)
  } catch (error) {
    console.error("Error saving playlists to localStorage:", error)
  }
}

// Функция для парсинга плейлистов артиста
export async function crawlArtistPlaylists(artistId: string): Promise<void> {
  try {
    const artist = await prisma.user.findFirst({
      where: { id: artistId, role: "artist" },
      select: { id: true, name: true, vkMusicUrl: true },
    })
    if (!artist || !artist.vkMusicUrl) {
      console.log(`Skipping artist ${artist?.name || artistId}: No VK Music URL`)
      return
    }

    console.log(`Crawling playlists for artist: ${artist.name} (${artist.vkMusicUrl})`)

    const html = await fetchHtml(artist.vkMusicUrl)

    if (!html) {
      console.log(`Could not fetch HTML for artist ${artist.name}, skipping`)
      return
    }

    const playlists = parseVkMusicArtistPage(html)

    console.log(`Found ${playlists.length} playlists for ${artist.name}`)

    if (playlists.length === 0) {
      return
    }

    persistPlaylistsJson(artist.id, artist.name, playlists)
  } catch (error) {
    console.error(`Error crawling playlists for artist ${artistId}:`, error)
  }
}

// Функция для парсинга плейлистов всех артистов
export async function crawlAllArtistsPlaylists(): Promise<void> {
  console.log("Starting playlist crawling for all artists...")

  const artistsWithVkMusic = await prisma.user.findMany({
    where: {
      role: "artist",
      AND: [{ vkMusicUrl: { not: null } }, { vkMusicUrl: { not: "" } }],
    },
    select: { id: true, name: true, vkMusicUrl: true },
  })
  console.log(`Found ${artistsWithVkMusic.length} artists with VK Music URLs`)

  for (const artist of artistsWithVkMusic) {
    try {
      await crawlArtistPlaylists(artist.id)
    } catch (error) {
      console.error(`Error processing artist ${artist.name} (ID: ${artist.id}):`, error)
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log("Playlist crawling completed")
}

// Функция для запуска периодического парсинга
export function startScheduledCrawling(intervalHours = 3): void {
  if (isScheduledCrawlingEnabled) return

  console.log(`Scheduled playlist crawling enabled, interval: ${intervalHours} hours`)
  isScheduledCrawlingEnabled = true

  const intervalMs = intervalHours * 60 * 60 * 1000

  if (crawlingInterval) {
    clearInterval(crawlingInterval)
  }

  void crawlAllArtistsPlaylists()

  crawlingInterval = setInterval(() => {
    void crawlAllArtistsPlaylists()
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
