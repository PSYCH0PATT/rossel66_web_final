import { NextResponse } from "next/server"
import { addReleaseWithActivities, getUserById } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { getSessionUser, requireAuth, requireAdmin } from "@/lib/server-auth"
import { getArtistGroupIds } from "@/lib/artist-links"
import { releasePostSchema } from "@/lib/api-schemas"
import { jsonWithPerfLog } from "@/lib/api-perf-log"
import { releaseListItemFromPrisma } from "@/lib/release-list-dto"

export const dynamic = "force-dynamic"

const PAGE_SIZES = new Set([20, 50, 100])

const LIST_SELECT = {
  id: true,
  title: true,
  artistId: true,
  releaseDate: true,
  type: true,
  coverUrl: true,
  upc: true,
  status: true,
  featuredArtistIds: true,
  featuredArtistNames: true,
  tracks: true,
  metadata: true,
} as const

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
  const raw = parseInt(searchParams.get("pageSize") || "20", 10) || 20
  const pageSize = PAGE_SIZES.has(raw) ? raw : 20
  return { page, pageSize, skip: (page - 1) * pageSize }
}

/** GET /api/releases — пагинация + опциональные фильтры (админ: всё; артист: только свой artistId) */
export async function GET(request: Request) {
  const startedAt = performance.now()
  const pathname = new URL(request.url).pathname

  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const session = getSessionUser()
    const { searchParams } = new URL(request.url)
    const { page, pageSize, skip } = parsePagination(searchParams)

    const artistId = searchParams.get("artistId") || undefined
    // Профиль внутри группы связанных профилей (AKA): фильтр «Профиль» в кабинете.
    const profileId = searchParams.get("profileId")?.trim() || undefined

    // Артист видит релизы своей группы, а не только своего id. Раньше здесь
    // стояло artistId === session.id, из-за чего кабинет группы отдавал 403 на
    // релизы привязанного профиля — и страница молча показывала «нет релизов».
    let scopeIds: string[] | undefined
    if (session?.role === "artist") {
      const groupIds = await getArtistGroupIds(session.id)
      if (!artistId || !groupIds.includes(artistId)) {
        return NextResponse.json({ success: false, error: "Доступ запрещён" }, { status: 403 })
      }
      scopeIds = profileId && groupIds.includes(profileId) ? [profileId] : groupIds
    } else if (artistId) {
      scopeIds = [artistId]
    }
    const q = searchParams.get("q")?.trim() || undefined
    const status = searchParams.get("status")?.trim() || undefined
    const artistName = searchParams.get("artistName")?.trim() || undefined
    const dateFrom = searchParams.get("dateFrom")?.trim() || undefined
    const dateTo = searchParams.get("dateTo")?.trim() || undefined

    const andParts: Prisma.ReleaseWhereInput[] = []

    if (scopeIds && scopeIds.length > 0) {
      // B1: показывать релизы, где артист — основной ИЛИ приглашённый (feat).
      // scopeIds — вся группа профилей либо один выбранный профиль.
      andParts.push({
        OR: [
          { artistId: { in: scopeIds } },
          { featuredArtistIds: { hasSome: scopeIds } },
        ],
      })
    }

    if (status && status !== "all") {
      andParts.push({ status })
    }

    if (q) {
      // Поиск ищет и по артисту: в админке набирали ник и получали пустой список,
      // потому что запрос смотрел только в название и UPC. Ник (username) тоже
      // учитывается — по нему артистов и опознают.
      const matchedByArtist = await prisma.user.findMany({
        where: {
          role: "artist",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
      const matchedIds = matchedByArtist.map((u) => u.id)

      andParts.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { upc: { contains: q, mode: "insensitive" } },
          ...(matchedIds.length
            ? [
                { artistId: { in: matchedIds } },
                { featuredArtistIds: { hasSome: matchedIds } },
              ]
            : []),
        ],
      })
    }

    if (artistName) {
      const matchingUsers = await prisma.user.findMany({
        where: {
          role: "artist",
          OR: [
            { name: { contains: artistName, mode: "insensitive" } },
            { username: { contains: artistName, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
      const ids = matchingUsers.map((u) => u.id)
      if (ids.length === 0) {
        return jsonWithPerfLog(pathname, startedAt, {
          success: true,
          releases: [],
          total: 0,
          page,
          pageSize,
        })
      }
      // B1: включаем и релизы, где найденные артисты — приглашённые (feat)
      andParts.push({
        OR: [{ artistId: { in: ids } }, { featuredArtistIds: { hasSome: ids } }],
      })
    }

    if (dateFrom || dateTo) {
      const rd: Prisma.StringFilter = {}
      if (dateFrom) rd.gte = dateFrom
      if (dateTo) rd.lte = dateTo
      andParts.push({ releaseDate: rd })
    }

    const where: Prisma.ReleaseWhereInput = andParts.length ? { AND: andParts } : {}

    const [total, rows] = await Promise.all([
      prisma.release.count({ where }),
      prisma.release.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ releaseDateSort: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
    ])

    const base = rows.map(releaseListItemFromPrisma)
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

    return jsonWithPerfLog(pathname, startedAt, {
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

    const artist = await getUserById(releaseData.artistId)

    const createdRelease = await addReleaseWithActivities(
      {
        artistId: releaseData.artistId,
        title: releaseData.title,
        coverUrl: releaseData.coverUrl || "",
        upc: releaseData.upc,
        releaseDate: releaseData.releaseDate,
        status: releaseData.status || "moderation",
        tracks: (releaseData.tracks || []) as unknown as import("@/lib/storage").Track[],
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

    return NextResponse.json({ success: true, release: createdRelease })
  } catch (error) {
    console.error("Ошибка при создании релиза:", error)
    return NextResponse.json({ success: false, error: "Failed to create release" }, { status: 500 })
  }
}
