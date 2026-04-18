import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { releaseFromPrisma } from "@/lib/storage-adapters"
import { requireAdminOrCron } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdminOrCron(request)
    if (denied) return denied

    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const minDate = twoWeeksAgo.toISOString().split("T")[0]

    const rawReleases = await prisma.release.findMany({
      where: { releaseDate: { gte: minDate } },
      orderBy: { createdAt: "desc" },
    })
    const recentReleases = rawReleases.map(releaseFromPrisma)

    const artistIds = [...new Set(recentReleases.map((r) => r.artistId).filter(Boolean))] as string[]
    if (artistIds.length === 0) {
      return NextResponse.json({
        success: true,
        artists: [],
        totalArtists: 0,
        totalReleases: recentReleases.length,
        dateRange: {
          from: minDate,
          to: new Date().toISOString().split("T")[0],
        },
      })
    }

    const users = await prisma.user.findMany({
      where: { id: { in: artistIds } },
    })
    const userById = new Map(users.map((u) => [u.id, u]))

    const resolveUser = (artistId: string) => {
      let u = userById.get(artistId)
      if (u) return u
      u = userById.get(artistId.replace("user_", ""))
      if (u) return u
      for (const [id, usr] of userById) {
        if (`user_${id}` === artistId) return usr
        if (id.replace("artist", "user_") === artistId) return usr
        if (id.replace("user_", "artist") === artistId) return usr
      }
      return undefined
    }

    const recentArtists = artistIds
      .map((artistId) => {
        const user = resolveUser(artistId)
        if (!user) return null
        const artistReleases = recentReleases.filter((r) => r.artistId === artistId)
        return {
          id: user.id,
          name: user.name,
          username: user.username || user.name.toLowerCase().replace(/\s+/g, ""),
          releasesCount: artistReleases.length,
          releases: artistReleases.map((r) => ({
            title: r.title,
            releaseDate: r.releaseDate,
          })),
        }
      })
      .filter(Boolean) as Array<{
      id: string
      name: string
      username: string
      releasesCount: number
      releases: { title: string; releaseDate: string }[]
    }>

    recentArtists.sort((a, b) => b.releasesCount - a.releasesCount)

    return NextResponse.json({
      success: true,
      artists: recentArtists,
      totalArtists: recentArtists.length,
      totalReleases: recentReleases.length,
      dateRange: {
        from: minDate,
        to: new Date().toISOString().split("T")[0],
      },
    })
  } catch (error) {
    console.error("Ошибка получения недавних артистов:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Ошибка получения недавних артистов",
      },
      { status: 500 }
    )
  }
}
