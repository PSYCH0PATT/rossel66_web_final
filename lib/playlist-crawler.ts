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

async function persistPlaylistsForArtist(
  artistId: string,
  artistName: string,
  playlists: ReturnType<typeof parseVkMusicArtistPage>
): Promise<void> {
  const { persistVkHtmlPlaylistsForArtist } = await import("@/lib/vk-playlists-persist")
  const stats = await persistVkHtmlPlaylistsForArtist(artistId, artistName, playlists)
  console.log(
    `[playlist-crawler] Postgres: +${stats.added} ~${stats.updated} =${stats.unchanged} for ${artistName}`
  )
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

    await persistPlaylistsForArtist(artist.id, artist.name, playlists)
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
