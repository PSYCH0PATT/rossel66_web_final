import { NextResponse } from "next/server"
import { addReleaseWithActivities, getUserById } from "@/lib/storage"
import { releaseFromPrisma } from "@/lib/storage-adapters"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { getSessionUser, requireAuth, requireAdmin } from "@/lib/server-auth"
import { releasePostSchema } from "@/lib/api-schemas"

export const dynamic = "force-dynamic"

const PAGE_SIZES = new Set([20, 50, 100])

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const raw = parseInt(searchParams.get("pageSize") || "20", 10) || 20
  const pageSize = PAGE_SIZES.has(raw) ? raw : 20
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** GET /api/releases — пагинация + опциональные фильтры (админ: всё; артист: только свой artistId) */
export async function GET(request: Request) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const session = getSessionUser()
    const { searchParams } = new URL(request.url)
    const { page, pageSize, skip } = parsePagination(searchParams)

    let artistId = searchParams.get("artistId") || undefined
    if (session?.role === "artist") {
      if (!artistId || artistId !== session.id) {
        return NextResponse.json({ success: false, error: "Доступ запрещён" }, { status: 403 })
      }
    }
    const q = searchParams.get("q")?.trim() || undefined
    const status = searchParams.get("status")?.trim() || undefined
    const artistName = searchParams.get("artistName")?.trim() || undefined
    const dateFrom = searchParams.get("dateFrom")?.trim() || undefined
    const dateTo = searchParams.get("dateTo")?.trim() || undefined

    const andParts: Prisma.ReleaseWhereInput[] = []

    if (artistId) {
      andParts.push({ artistId })
    }

    if (status && status !== "all") {
      andParts.push({ status })
    }

    if (q) {
      andParts.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { upc: { contains: q, mode: "insensitive" } },
        ],
      })
    }

    if (artistName) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          role: "artist",
          name: { contains: artistName, mode: "insensitive" },
        },
        select: { id: true },
      })
      const ids = matchingUsers.map((u) => u.id)
      if (ids.length === 0) {
        return NextResponse.json({
          success: true,
          releases: [],
          total: 0,
          page,
          pageSize,
        })
      }
      andParts.push({ artistId: { in: ids } })
    }

    if (dateFrom || dateTo) {
      const rd: Prisma.StringFilter = {}
      if (dateFrom) rd.gte = dateFrom
      if (dateTo) rd.lte = dateTo
      andParts.push({ releaseDate: rd })
    }

    const where: Prisma.ReleaseWhereInput = andParts.length ? { AND: andParts } : {}

    const [raw, total] = await Promise.all([
      prisma.release.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.release.count({ where }),
    ])

    const base = raw.map(releaseFromPrisma)
    const artistIds = [...new Set(base.map((r) => r.artistId).filter(Boolean))] as string[]
    const users =
      artistIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: artistIds } },
            select: { id: true, name: true, username: true },
          })
        : []
    const nameById = new Map(users.map((u) => [u.id, u.name || u.username]))

    const releases = base.map((r) => ({
      ...r,
      artistName: r.artistId ? nameById.get(r.artistId) ?? "" : "",
    }))

    return NextResponse.json({
      success: true,
      releases,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Ошибка при загрузке релизов:", error)
    return NextResponse.json({ success: false, error: "Failed to load releases" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const raw = await request.json()
    const parsed = releasePostSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Некорректные данные", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const releaseData = parsed.data

    console.log("Получены данные для создания релиза:", releaseData)

    const newRelease = {
      id: `release_${Date.now()}`,
      artistId: releaseData.artistId,
      title: releaseData.title,
      coverUrl: releaseData.coverUrl || "",
      upc: releaseData.upc,
      releaseDate: releaseData.releaseDate,
      status: releaseData.status || "moderation",
      tracks: (releaseData.tracks || []) as unknown as import("@/lib/storage").Track[],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    console.log("Создаем релиз с данными:", newRelease)

    const artist = await getUserById(releaseData.artistId)

    const createdRelease = await addReleaseWithActivities(
      {
        artistId: newRelease.artistId,
        title: newRelease.title,
        coverUrl: newRelease.coverUrl,
        upc: newRelease.upc,
        releaseDate: newRelease.releaseDate,
        status: newRelease.status,
        tracks: newRelease.tracks,
      },
      (created) =>
        artist
          ? [
              {
                type: "release_added",
                userId: artist.id,
                userRole: "artist",
                title: "Добавлен новый релиз",
                description: `Релиз "${created.title}" успешно добавлен`,
                metadata: { releaseId: created.id, releaseTitle: created.title },
              },
              {
                type: "release_added",
                userId: "system",
                userRole: "admin",
                title: "Добавлен новый релиз",
                description: `Релиз "${created.title}" добавлен (артист: ${artist.name || artist.username})`,
                metadata: {
                  releaseId: created.id,
                  releaseTitle: created.title,
                  artistId: artist.id,
                  artistName: artist.name,
                },
              },
            ]
          : []
    )

    console.log("Релиз успешно сохранен")

    return NextResponse.json({ success: true, release: createdRelease })
  } catch (error) {
    console.error("Ошибка при создании релиза:", error)
    return NextResponse.json({ success: false, error: "Failed to create release" }, { status: 500 })
  }
}
