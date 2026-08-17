import { NextResponse } from "next/server"
import { updateRelease, deleteRelease, getUserById, type Release } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { releaseFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import { getArtistGroupIds } from "@/lib/artist-links"
import { releasePutSchema } from "@/lib/api-schemas"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const { id } = params
    const raw = await prisma.release.findUnique({ where: { id } })
    if (!raw) {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }

    const release = releaseFromPrisma(raw)
    // Тот же охват, что и в списке релизов: свои релизы группы (AKA) плюс те, где
    // кто-то из группы приглашённый. Без второго условия карточка отдавала 403 на
    // релиз, который в списке при этом показывался, — «Релиз не найден» на своей же
    // строке.
    if (session.role !== "admin") {
      const groupIds = await getArtistGroupIds(session.id)
      const owns = release.artistId ? groupIds.includes(release.artistId) : false
      const featured = (release.featuredArtistIds ?? []).some((id) => groupIds.includes(id))
      if (!owns && !featured) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
      }
    }
    const artist = release.artistId ? await getUserById(release.artistId) : null
    const releaseWithArtist = {
      ...release,
      artistName: artist ? artist.name : "Неизвестный артист",
    }

    return NextResponse.json({ success: true, release: releaseWithArtist })
  } catch (error) {
    console.error("Ошибка при загрузке релиза:", error)
    return NextResponse.json({ success: false, error: "Failed to load release" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const { id } = params
    const raw = await prisma.release.findUnique({ where: { id }, select: { artistId: true } })
    if (!raw) {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }
    // На запись охват уже: приглашённый релиз видит, но не правит — это чужой релиз.
    if (session.role !== "admin") {
      const groupIds = await getArtistGroupIds(session.id)
      if (!raw.artistId || !groupIds.includes(raw.artistId)) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await request.json()
    const parsed = releasePutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const updates = parsed.data

    const updatedRelease = await updateRelease(id, updates as Partial<Release>)

    if (updatedRelease) {
      return NextResponse.json({ success: true, message: "Release updated successfully" })
    } else {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }
  } catch (error) {
    console.error("Ошибка при обновлении релиза:", error)
    return NextResponse.json({ success: false, error: "Failed to update release" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const { id } = params
    const raw = await prisma.release.findUnique({ where: { id }, select: { artistId: true } })
    if (!raw) {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }
    if (session.role !== "admin" && raw.artistId !== session.id) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const success = await deleteRelease(id)

    if (success) {
      return NextResponse.json({ success: true, message: "Release deleted successfully" })
    } else {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }
  } catch (error) {
    console.error("Ошибка при удалении релиза:", error)
    return NextResponse.json({ success: false, error: "Failed to delete release" }, { status: 500 })
  }
}
