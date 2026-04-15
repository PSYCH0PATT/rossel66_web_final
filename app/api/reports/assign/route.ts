import { NextResponse } from "next/server"
import { moveReportToArtist, addActivity } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"

export async function POST(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const { reportId, artistId } = await request.json()

    if (!reportId || !artistId) {
      return NextResponse.json({ error: "Не указаны ID отчета или артиста" }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: artistId } })
    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
    }
    if (targetUser.role !== "artist") {
      return NextResponse.json({ error: "Назначать отчёт можно только артисту" }, { status: 400 })
    }

    const success = await moveReportToArtist(reportId, artistId)

    if (success) {
      await addActivity({
        type: 'report_received',
        userId: artistId,
        userRole: 'artist',
        title: 'Назначен отчёт',
        description: 'Вам назначен отчёт по кварталу',
        metadata: { reportId, artistId }
      })
      return NextResponse.json({
        success: true,
        message: "Отчет успешно назначен артисту"
      })
    } else {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }
  } catch (error) {
    console.error("Ошибка при назначении отчета:", error)
    return NextResponse.json(
      { error: "Ошибка при назначении отчета" },
      { status: 500 }
    )
  }
}








