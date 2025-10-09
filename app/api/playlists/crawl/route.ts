import { NextResponse } from "next/server"
import { crawlAllArtistsPlaylists } from "@/lib/playlist-crawler"

export async function POST() {
  try {
    // Запускаем парсинг плейлистов
    console.log("[SERVER] Starting playlist crawling for all artists...")

    // Запускаем парсинг асинхронно, чтобы не блокировать ответ
    crawlAllArtistsPlaylists().catch((error) => {
      console.error("[SERVER] Error during playlist crawling:", error)
    })

    return NextResponse.json({ success: true, message: "Playlist crawling initiated" })
  } catch (error) {
    console.error("[SERVER] Error initiating playlist crawling:", error)
    return NextResponse.json({ success: false, error: "Failed to initiate playlist crawling" }, { status: 500 })
  }
}
