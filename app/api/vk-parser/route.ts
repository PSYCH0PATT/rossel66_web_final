import { type NextRequest, NextResponse } from "next/server"
import { parseVkMusicArtistPage, addPlaylistsToArtist } from "@/lib/vk-parser"
import { users } from "@/lib/data"

export async function POST(request: NextRequest) {
  try {
    const { html, artistId } = await request.json()

    if (!html || !artistId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Проверяем, существует ли артист
    const artist = users.find((user) => user.id === artistId)
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    // Парсим HTML и получаем плейлисты
    const playlists = parseVkMusicArtistPage(html)

    if (playlists.length === 0) {
      return NextResponse.json({ message: "No playlists found", playlists: [] })
    }

    // Добавляем плейлисты артисту
    await addPlaylistsToArtist(artistId, playlists)

    return NextResponse.json({
      message: `Successfully added ${playlists.length} playlists to artist ${artist.name}`,
      playlists,
    })
  } catch (error) {
    console.error("Error parsing VK Music page:", error)
    return NextResponse.json({ error: "Failed to parse VK Music page" }, { status: 500 })
  }
}
