import { type NextRequest, NextResponse } from "next/server"
import { parseVkMusicArtistPage, addPlaylistsToArtist } from "@/lib/vk-parser"
import { prisma } from "@/lib/prisma"
import { requireSelfOrAdmin } from "@/lib/server-auth"
import { z } from "zod"

const bodySchema = z.object({
  html: z.string().min(1),
  artistId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 })
    }
    const { html, artistId } = parsed.data

    const denied = await requireSelfOrAdmin(request, artistId)
    if (denied) return denied

    const artistRow = await prisma.user.findUnique({ where: { id: artistId } })
    if (!artistRow || artistRow.role !== "artist") {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 })
    }

    const playlists = parseVkMusicArtistPage(html)

    if (playlists.length === 0) {
      return NextResponse.json({ message: "No playlists found", playlists: [] })
    }

    await addPlaylistsToArtist(artistId, playlists)

    return NextResponse.json({
      message: `Successfully added ${playlists.length} playlists to artist ${artistRow.name}`,
      playlists,
    })
  } catch (error) {
    console.error("Error parsing VK Music page:", error)
    return NextResponse.json({ error: "Failed to parse VK Music page" }, { status: 500 })
  }
}
