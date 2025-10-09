import { NextResponse } from "next/server"
import { reports } from "@/lib/data"

export async function GET() {
  try {
    // Находим индексы фейковых отчетов
    const fakeReportIndices = reports
      .map((report, index) => (report.isRegistered === false ? index : -1))
      .filter((index) => index !== -1)
      .sort((a, b) => b - a) // Сортируем в обратном порядке, чтобы удалять с конца

    // Удаляем фейковые отчеты
    fakeReportIndices.forEach((index) => {
      reports.splice(index, 1)
    })

    return NextResponse.json({
      success: true,
      message: `Удалено ${fakeReportIndices.length} фейковых отчетов`,
      remainingReports: reports.length,
    })
  } catch (error) {
    console.error("Ошибка при удалении фейковых отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при удалении фейковых отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
