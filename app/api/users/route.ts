import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const ALLOWED_PAGE_SIZES = new Set([20, 50, 100])

const userSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  vkMusicUrl: true,
  yandexMusicUrl: true,
  spotifyUrl: true,
  createdAt: true,
} as const

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const usernameExact = searchParams.get("username")

    if (id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: userSelect,
      })
      return NextResponse.json({
        success: true,
        users: user ? [user] : [],
        total: user ? 1 : 0,
        page: 1,
        pageSize: 1,
      })
    }

    if (usernameExact) {
      const roleFilter = searchParams.get("role")
      const user = await prisma.user.findFirst({
        where: {
          username: usernameExact,
          ...(roleFilter && roleFilter !== "all" ? { role: roleFilter } : {}),
        },
        select: userSelect,
      })
      return NextResponse.json({
        success: true,
        users: user ? [user] : [],
        total: user ? 1 : 0,
        page: 1,
        pageSize: 1,
      })
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const rawPs = parseInt(searchParams.get("pageSize") || "20", 10)
    const pageSize = ALLOWED_PAGE_SIZES.has(rawPs) ? rawPs : 20
    const q = (searchParams.get("q") || "").trim()
    const roleFilter = searchParams.get("role")

    const where: Prisma.UserWhereInput = {}

    if (roleFilter && roleFilter !== "all") {
      where.role = roleFilter
    }

    if (q.length > 0) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ]
    }

    const skip = (page - 1) * pageSize

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "asc" },
        select: userSelect,
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      users,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Error loading users:", error)
    return NextResponse.json({ error: "Error loading users" }, { status: 500 })
  }
}
