import { NextResponse } from "next/server"
import { processExcelFile } from "@/lib/report-generator"
import { prisma } from "@/lib/prisma"
import * as fs from "fs"
import * as path from "path"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const templateFile = formData.get("template_file") as File
    const artistsFile = formData.get("artists_file") as File
    const quarter = formData.get("quarter") as string
    const isrcColumn = formData.get("isrc_column") as string
    const trackNameColumn = formData.get("track_name_column") as string
    const albumNameColumn = formData.get("album_name_column") as string
    const artistColumn = formData.get("artist_column") as string
    const playsColumn = formData.get("plays_column") as string
    const amountColumn = formData.get("amount_column") as string

    // Проверка обязательных полей
    if (
      !file ||
      !templateFile ||
      !artistsFile ||
      !quarter ||
      !isrcColumn ||
      !trackNameColumn ||
      !albumNameColumn ||
      !artistColumn ||
      !playsColumn ||
      !amountColumn
    ) {
      return NextResponse.json({ error: "Не все обязательные поля заполнены" }, { status: 400 })
    }

    // Проверка формата файлов
    if (!file.name.endsWith(".xlsx") || !templateFile.name.endsWith(".xlsx") || !artistsFile.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Поддерживаются только файлы формата .xlsx" }, { status: 400 })
    }

    // Создаем маппинг столбцов
    const columnMapping = {
      isrc_column: isrcColumn,
      track_name_column: trackNameColumn,
      album_name_column: albumNameColumn,
      artist_column: artistColumn,
      plays_column: playsColumn,
      amount_column: amountColumn,
    }

    console.log("Начинаем обработку файлов...")
    console.log("Маппинг столбцов:", columnMapping)

    // Обрабатываем файлы и генерируем отчеты
    const result = await processExcelFile(file, templateFile, artistsFile, columnMapping, quarter)

    console.log(`Обработка завершена. Сгенерировано отчетов: ${result.reports.length}`)

    // Создаем директорию для сохранения файлов
    const uploadsDir = path.join(process.cwd(), "uploads", "reports", quarter)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Сохраняем файлы и создаём записи в БД
    const savedReports = []
    for (let i = 0; i < result.reports.length; i++) {
      const report = result.reports[i]
      const reportFile = result.reportFiles[i]

      // Сохраняем файл на диск
      const filePath = path.join(uploadsDir, report.fileName)
      const arrayBuffer = await reportFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      fs.writeFileSync(filePath, buffer)

      // Относительный путь для БД
      const relativeFilePath = `uploads/reports/${quarter}/${report.fileName}`

      // Создаём запись в БД
      await prisma.report.create({
        data: {
          id: report.id,
          artistId: report.artistId || null,
          artistName: report.artistId, // artistId содержит имя артиста
          quarter: quarter,
          year: report.year,
          fileName: report.fileName,
          filePath: relativeFilePath,
          uploadDate: report.uploadDate,
          status: report.status || "processed",
          totalPlays: report.totalPlays || 0,
          totalAmount: report.totalAmount || 0,
          isRegistered: report.isRegistered ?? true,
          isSigned: false,
          isPaid: false,
          processed: true,
        }
      })

      savedReports.push({
        id: report.id,
        artistName: report.artistId,
        fileName: report.fileName,
        totalPlays: report.totalPlays,
        totalAmount: report.totalAmount,
      })
    }

    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      message: "Отчеты успешно сгенерированы и сохранены",
      processedArtists: savedReports.length,
      quarter,
      reports: savedReports,
    })
  } catch (error) {
    console.error("Ошибка при обработке отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при обработке отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
