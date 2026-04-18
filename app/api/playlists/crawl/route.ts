import { NextResponse } from "next/server"
import { crawlAllArtistsPlaylists } from "@/lib/playlist-crawler"
import { requireAdmin } from "@/lib/server-auth"

export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

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
