import { NextResponse } from "next/server"
import { requireAuth, requireSelfOrAdmin } from "@/lib/server-auth"
import { getCachedArtistDashboard } from "@/lib/cached-dashboard"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: { username: string } }) {
  try {
    const deniedAuth = await requireAuth(request)
    if (deniedAuth) return deniedAuth

    const { username } = params

    const result = await getCachedArtistDashboard(username)

    if (!result.ok) {
      return NextResponse.json({ error: "Артист не найден" }, { status: 404 })
    }

    const { data } = result

    const deniedScope = await requireSelfOrAdmin(request, data.artist.id)
    if (deniedScope) return deniedScope

    return NextResponse.json({
      success: true,
      artist: data.artist,
      releaseCount: data.releaseCount,
      releasedCount: data.releasedCount,
      playlistCount: data.playlistCount,
      reports: data.reports,
    })
  } catch (error) {
    console.error("Ошибка artist-dashboard:", error)
    return NextResponse.json(
      { error: `Ошибка загрузки данных: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
