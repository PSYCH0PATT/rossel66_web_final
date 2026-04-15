import { NextResponse } from "next/server"
import { updateRelease, deleteRelease, getUserById } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { releaseFromPrisma } from "@/lib/storage-adapters"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const raw = await prisma.release.findUnique({ where: { id } })
    if (!raw) {
      return NextResponse.json({ success: false, error: "Release not found" }, { status: 404 })
    }

    const release = releaseFromPrisma(raw)
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
    const { id } = params
    const updates = await request.json()

    const updatedRelease = await updateRelease(id, updates)

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
    const { id } = params

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
