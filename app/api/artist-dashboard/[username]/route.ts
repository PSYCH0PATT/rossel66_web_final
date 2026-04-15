import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/server-auth"
import { getCachedArtistDashboard } from "@/lib/cached-dashboard"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { username: string } }) {
  try {
    const sessionUser = getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
    }

    const { username } = params

    const result = await getCachedArtistDashboard(username)

    if (!result.ok) {
      return NextResponse.json({ error: "Артист не найден" }, { status: 404 })
    }

    const { data } = result

    if (sessionUser.role === "artist" && sessionUser.id !== data.artist.id) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      artist: data.artist,
      releases: data.releases,
      reports: data.reports,
      playlists: data.playlists,
    })
  } catch (error) {
    console.error("Ошибка artist-dashboard:", error)
    return NextResponse.json(
      { error: `Ошибка загрузки данных: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
