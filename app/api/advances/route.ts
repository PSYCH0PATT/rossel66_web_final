import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireAdmin, requireSelfOrAdmin } from "@/lib/server-auth"
import { addActivity, getUserById } from "@/lib/storage"
import { advancePostSchema } from "@/lib/api-schemas"
import { revalidateArtistDashboardsForArtistIds } from "@/lib/revalidate-artist-dashboard"

export const dynamic = "force-dynamic"

/** Список авансов артиста: админу — любого, артисту — только своего. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const artistId = searchParams.get("artistId")?.trim()
  if (!artistId) {
    return NextResponse.json({ error: "artistId обязателен" }, { status: 400 })
  }

  const denied = await requireSelfOrAdmin(request, artistId)
  if (denied) return denied

  const advances = await prisma.advance.findMany({
    where: { artistId },
    orderBy: { issuedAt: "desc" },
  })

  return NextResponse.json({
    advances: advances.map((a) => ({
      id: a.id,
      artistId: a.artistId,
      amount: a.amount,
      issuedAt: a.issuedAt.toISOString(),
      comment: a.comment,
      createdBy: a.createdBy,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const sessionUser = getSessionUser()!

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 })
  }

  const parsed = advancePostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректные данные", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { artistId, amount, issuedAt, comment } = parsed.data

  const artist = await getUserById(artistId)
  if (!artist || artist.role !== "artist") {
    return NextResponse.json({ error: "Артист не найден" }, { status: 404 })
  }

  const issued = new Date(issuedAt)
  if (Number.isNaN(issued.getTime())) {
    return NextResponse.json({ error: "Некорректная дата выдачи" }, { status: 400 })
  }

  const advance = await prisma.advance.create({
    data: {
      artistId,
      amount,
      issuedAt: issued,
      comment: comment?.trim() || null,
      createdBy: sessionUser.username,
    },
  })

  await addActivity({
    type: "advance_issued",
    userId: sessionUser.id,
    userRole: "admin",
    title: "Аванс выдан",
    description: `${artist.name}: аванс ${amount.toLocaleString("ru-RU")} ₽ от ${issued.toLocaleDateString("ru-RU")}`,
    metadata: { advanceId: advance.id, artistId, amount, issuedAt: advance.issuedAt.toISOString() },
  })

  // Баланс артиста и «доступно к выплате» пересчитываются из авансов — сбрасываем кэш кабинета.
  await revalidateArtistDashboardsForArtistIds([artistId])

  return NextResponse.json({
    advance: {
      id: advance.id,
      artistId: advance.artistId,
      amount: advance.amount,
      issuedAt: advance.issuedAt.toISOString(),
      comment: advance.comment,
      createdBy: advance.createdBy,
      createdAt: advance.createdAt.toISOString(),
    },
  })
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const sessionUser = getSessionUser()!

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 })
  }

  const advance = await prisma.advance.findUnique({ where: { id } })
  if (!advance) {
    return NextResponse.json({ error: "Аванс не найден" }, { status: 404 })
  }

  await prisma.advance.delete({ where: { id } })

  const artist = await getUserById(advance.artistId)
  await addActivity({
    type: "advance_removed",
    userId: sessionUser.id,
    userRole: "admin",
    title: "Аванс удалён",
    description: `${artist?.name ?? advance.artistId}: аванс ${advance.amount.toLocaleString("ru-RU")} ₽ от ${advance.issuedAt.toLocaleDateString("ru-RU")}`,
    metadata: { advanceId: advance.id, artistId: advance.artistId, amount: advance.amount },
  })

  await revalidateArtistDashboardsForArtistIds([advance.artistId])

  return NextResponse.json({ success: true })
}
