import { NextResponse } from "next/server"
import { processReportFile } from "@/lib/report-processor"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const quarter = formData.get("quarter") as string
    const year = parseInt(formData.get("year") as string) || new Date().getFullYear()
    
    // Маппинг столбцов
    const columnMapping = {
      isrc_column: formData.get("isrc_column") as string,
      track_name_column: formData.get("track_name_column") as string,
      album_name_column: formData.get("album_name_column") as string,
      artist_column: formData.get("artist_column") as string,
      plays_column: formData.get("plays_column") as string,
      amount_column: formData.get("amount_column") as string,
    }

    if (!file) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
    }

    if (!quarter) {
      return NextResponse.json({ error: "Квартал не указан" }, { status: 400 })
    }

    // Проверяем, что все необходимые столбцы выбраны
    const requiredColumns = Object.values(columnMapping)
    if (requiredColumns.some(col => !col)) {
      return NextResponse.json({ error: "Не все столбцы выбраны" }, { status: 400 })
    }

    // Обрабатываем файл (создаёт файлы на диск)
    const result = await processReportFile(file, quarter, year, columnMapping)

    // Сохраняем отчёты в БД
    for (const report of result.reports) {
      await prisma.report.create({
        data: {
          id: report.id,
          artistId: report.artistId || null,
          artistName: report.artistName,
          quarter: quarter,
          year: year,
          fileName: report.fileName,
          filePath: report.filePath,
          uploadDate: report.uploadDate,
          status: report.status || 'processed',
          totalPlays: report.totalPlays || 0,
          totalAmount: report.totalAmount || 0,
          isRegistered: report.isRegistered ?? false,
          isSigned: false,
          isPaid: false,
          processed: true,
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      processedArtists: result.processedArtists,
      reports: result.reports.map(report => ({
        id: report.id,
        artistName: report.artistName,
        isRegistered: report.isRegistered,
        totalPlays: report.totalPlays,
        totalAmount: report.totalAmount,
      }))
    })

  } catch (error) {
    console.error("Ошибка при обработке отчета:", error)
    return NextResponse.json(
      { error: `Ошибка при обработке отчета: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}








