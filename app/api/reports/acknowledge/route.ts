import { NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { addActivity } from "@/lib/storage"
import { canAcknowledgeReports } from "@/lib/report-acknowledgment"
import { getSessionUser } from "@/lib/server-auth"
import { CACHE_TAG_ARTIST_DASHBOARD } from "@/lib/dashboard-cache-tags"

export async function POST(request: Request) {
  const session = getSessionUser()
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  if (session.role !== "artist") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { reportId?: string }
    const reportId = body.reportId
    if (!reportId) {
      return NextResponse.json({ error: "reportId обязателен" }, { status: 400 })
    }

    const report = await prisma.report.findUnique({ where: { id: reportId } })
    if (!report) {
      return NextResponse.json({ error: "Отчёт не найден" }, { status: 404 })
    }
    if (report.artistId !== session.id) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
    }

    if (report.isAcknowledged === true) {
      return NextResponse.json({
        success: true,
        alreadyAcknowledged: true,
        message: "Вы уже ознакомились с этим отчётом",
        acknowledgedAt: report.acknowledgedAt?.toISOString() ?? null,
      })
    }

    const artistReports = await prisma.report.findMany({
      where: { artistId: session.id, isRegistered: true },
      select: { totalAmount: true, isPaid: true },
    })

    const gate = canAcknowledgeReports(artistReports)
    if (!gate.allowed) {
      return NextResponse.json(
        { error: gate.reason ?? "Ознакомление недоступно", unpaidTotal: gate.unpaidTotal },
        { status: 400 }
      )
    }

    const acknowledgedAt = new Date()
    await prisma.report.update({
      where: { id: reportId },
      data: {
        isAcknowledged: true,
        acknowledgedAt,
      },
    })

    await addActivity({
      type: "report_status_changed",
      userId: session.id,
      userRole: "artist",
      title: "Ознакомление с отчётом",
      description: `Артист ознакомился с отчётом за ${report.quarter} ${report.year ?? ""}`.trim(),
      metadata: {
        reportId,
        artistId: session.id,
        field: "isAcknowledged",
        newValue: true,
      },
    })

    revalidateTag(CACHE_TAG_ARTIST_DASHBOARD)
    revalidatePath(`/dashboard/artist/${session.username}/reports`)

    return NextResponse.json({
      success: true,
      message: "Спасибо. Ссылка на подписание будет в рабочем Telegram-канале.",
      acknowledgedAt: acknowledgedAt.toISOString(),
    })
  } catch (error) {
    console.error("Ошибка при ознакомлении с отчётом:", error)
    return NextResponse.json({ error: "Не удалось сохранить ознакомление" }, { status: 500 })
  }
}
