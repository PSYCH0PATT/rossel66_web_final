import { NextResponse } from "next/server"
import { moveReportToArtist, addActivity } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const { reportId, artistId } = await request.json()

    if (!reportId || !artistId) {
      return NextResponse.json({ error: "Не указаны ID отчета или артиста" }, { status: 400 })
    }

    const success = moveReportToArtist(reportId, artistId)

    if (success) {
      addActivity({
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








