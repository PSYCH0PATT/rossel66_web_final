import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { reports } from "@/lib/data"

// Директория для сохранения отчетов
const REPORTS_DIR = path.join(process.cwd(), "reports")

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const quarter = formData.get("quarter") as string

    if (!quarter) {
      return NextResponse.json({ error: "Не указан квартал" }, { status: 400 })
    }

    // Создаем директорию для квартала, если её нет
    const quarterDir = path.join(REPORTS_DIR, quarter)
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true })
    }
    if (!fs.existsSync(quarterDir)) {
      fs.mkdirSync(quarterDir, { recursive: true })
    }

    // Получаем все файлы из FormData
    const files = formData.getAll("files") as File[]
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Нет файлов для сохранения" }, { status: 400 })
    }

    // Сохраняем каждый файл
    const savedFiles = []
    for (const file of files) {
      const fileName = file.name
      const filePath = path.join(quarterDir, fileName)

      // Преобразуем File в Buffer и сохраняем
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      fs.writeFileSync(filePath, buffer)

      savedFiles.push({
        name: fileName,
        path: filePath,
      })

      // Добавляем информацию о файле в список отчетов
      const artistId = fileName.split("_")[0]
      const reportId = `r${Date.now()}-${artistId}`

      reports.push({
        id: reportId,
        artistId,
        quarter,
        year: new Date().getFullYear(),
        fileUrl: `/api/reports/download/${reportId}`,
        uploadDate: new Date().toISOString(),
        status: "processed",
        generatedDate: new Date().toISOString(),
        fileName,
        isRegistered: true,
        totalPlays: 0, // Эти данные будут обновлены при запросе отчета
        totalAmount: 0,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Сохранено ${savedFiles.length} файлов в папку ${quarter}`,
      savedFiles,
    })
  } catch (error) {
    console.error("Ошибка при сохранении отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при сохранении отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
