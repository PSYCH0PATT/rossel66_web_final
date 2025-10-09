import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import * as JSZip from "jszip"

// Директория для сохранения отчетов
const REPORTS_DIR = path.join(process.cwd(), "reports")

export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const quarter = params.quarter
    const quarterDir = path.join(REPORTS_DIR, quarter)

    // Проверяем существование директории
    if (!fs.existsSync(quarterDir)) {
      return NextResponse.json({ error: "Директория с отчетами не найдена" }, { status: 404 })
    }

    // Получаем список файлов в директории
    const files = fs.readdirSync(quarterDir).filter((file) => file.endsWith(".xlsx"))

    if (files.length === 0) {
      return NextResponse.json({ error: "Нет отчетов за выбранный квартал" }, { status: 404 })
    }

    // Создаем ZIP-архив
    const zip = new JSZip()

    // Добавляем файлы в архив
    for (const file of files) {
      const filePath = path.join(quarterDir, file)
      const fileData = fs.readFileSync(filePath)
      zip.file(file, fileData)
    }

    // Генерируем ZIP-архив
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // Отправляем архив клиенту
    const headers = new Headers()
    headers.set("Content-Type", "application/zip")
    headers.set("Content-Disposition", `attachment; filename="${quarter}_reports.zip"`)

    return new NextResponse(zipBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Ошибка при скачивании отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при скачивании отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
