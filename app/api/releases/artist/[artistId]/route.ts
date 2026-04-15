import { NextResponse } from "next/server"
import { getReleasesByArtist, getUserById } from "@/lib/storage"

export async function GET(request: Request, { params }: { params: { artistId: string } }) {
  try {
    const { artistId } = params
    const releases = await getReleasesByArtist(artistId)
    const artist = await getUserById(artistId)

    const releasesWithArtist = releases.map((release) => ({
      ...release,
      artistName: artist ? artist.name : "Неизвестный артист",
    }))

    return NextResponse.json({ success: true, releases: releasesWithArtist })
  } catch (error) {
    console.error("Ошибка при загрузке релизов артиста:", error)
    return NextResponse.json({ success: false, error: "Failed to load artist releases" }, { status: 500 })
  }
}
