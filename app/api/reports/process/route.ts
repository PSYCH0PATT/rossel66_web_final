import { NextResponse } from "next/server"
import { reports } from "@/lib/data"
import { processExcelFile } from "@/lib/report-generator"

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

    // Добавляем сгенерированные отчеты в общий список отчетов
    reports.push(...result.reports)

    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      message: "Отчеты успешно сгенерированы",
      processedArtists: result.reports.length,
      quarter,
      reports: result.reports,
    })
  } catch (error) {
    console.error("Ошибка при обработке отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при обработке отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
