import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireAdmin } from "@/lib/server-auth"
import { validateLinkPair } from "@/lib/artist-links"
import { addActivity } from "@/lib/storage"
import { revalidateArtistDashboardsForArtistIds } from "@/lib/revalidate-artist-dashboard"
import { CACHE_TAG_STREAM_ANALYTICS } from "@/lib/dashboard-cache-tags"

export const dynamic = "force-dynamic"

const linkSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  mainArtistId: true,
} as const

/**
 * Кабинет главного показывает данные привязанных профилей, поэтому после
 * привязки/отвязки надо сбросить и дашборды обеих сторон, и кэш аналитики.
 */
async function revalidateBoth(usernames: string[], artistIds: string[]) {
  await revalidateArtistDashboardsForArtistIds(artistIds)
  revalidateTag(CACHE_TAG_STREAM_ANALYTICS)
  for (const username of usernames) {
    for (const page of ["dashboard", "analytics", "reports", "payments", "releases"]) {
      revalidatePath(`/dashboard/artist/${username}/${page}`)
    }
  }
}

/** Привязать профиль к главному. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const sessionUser = getSessionUser()!

  let body: { mainArtistId?: unknown; linkedArtistId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 })
  }

  const mainArtistId = typeof body.mainArtistId === "string" ? body.mainArtistId.trim() : ""
  const linkedArtistId = typeof body.linkedArtistId === "string" ? body.linkedArtistId.trim() : ""
  if (!mainArtistId || !linkedArtistId) {
    return NextResponse.json(
      { error: "mainArtistId и linkedArtistId обязательны" },
      { status: 400 }
    )
  }

  const [main, linked, linkedChildrenCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: mainArtistId }, select: linkSelect }),
    prisma.user.findUnique({ where: { id: linkedArtistId }, select: linkSelect }),
    prisma.user.count({ where: { mainArtistId: linkedArtistId } }),
  ])

  const check = validateLinkPair(main, linked, linkedChildrenCount)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: linkedArtistId },
    data: { mainArtistId },
  })

  await addActivity({
    type: "user_data_updated",
    userId: sessionUser.id,
    userRole: "admin",
    title: "Профиль привязан к артисту",
    description: `«${linked!.name}» привязан к «${main!.name}» — статистика и отчёты собираются в кабинете главного`,
    metadata: { mainArtistId, linkedArtistId, action: "link" },
  })

  await revalidateBoth([main!.username, linked!.username], [mainArtistId, linkedArtistId])

  return NextResponse.json({ success: true })
}

/** Отвязать профиль. */
export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  const sessionUser = getSessionUser()!

  const { searchParams } = new URL(request.url)
  const linkedArtistId = searchParams.get("linkedArtistId")?.trim()
  if (!linkedArtistId) {
    return NextResponse.json({ error: "linkedArtistId обязателен" }, { status: 400 })
  }

  const linked = await prisma.user.findUnique({
    where: { id: linkedArtistId },
    select: linkSelect,
  })
  if (!linked) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 })
  }
  if (!linked.mainArtistId) {
    return NextResponse.json({ error: "Профиль ни к кому не привязан" }, { status: 400 })
  }

  const main = await prisma.user.findUnique({
    where: { id: linked.mainArtistId },
    select: linkSelect,
  })

  await prisma.user.update({
    where: { id: linkedArtistId },
    data: { mainArtistId: null },
  })

  await addActivity({
    type: "user_data_updated",
    userId: sessionUser.id,
    userRole: "admin",
    title: "Профиль отвязан от артиста",
    description: `«${linked.name}» отвязан от «${main?.name ?? linked.mainArtistId}»`,
    metadata: { mainArtistId: linked.mainArtistId, linkedArtistId, action: "unlink" },
  })

  await revalidateBoth(
    [linked.username, main?.username].filter((u): u is string => Boolean(u)),
    [linkedArtistId, linked.mainArtistId]
  )

  return NextResponse.json({ success: true })
}
