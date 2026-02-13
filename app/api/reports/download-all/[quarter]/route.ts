import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import * as JSZip from "jszip"
import { loadReports } from "@/lib/storage"

export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const quarter = params.quarter
    
    // Получаем список отчетов из БД
    const allReports = await loadReports()
    const quarterReports = allReports.filter(report => report.quarter === quarter)

    if (quarterReports.length === 0) {
      return NextResponse.json({ error: "Нет отчетов за выбранный квартал" }, { status: 404 })
    }

    // Создаем ZIP-архив
    const zip = new JSZip()

    // Добавляем файлы в архив
    for (const report of quarterReports) {
      if (!report.filePath) {
        console.warn(`Отчет ${report.id} не имеет пути к файлу`)
        continue
      }
      
      const filePath = path.join(process.cwd(), report.filePath)
      
      if (!fs.existsSync(filePath)) {
        console.warn(`Файл не найден: ${filePath}`)
        continue
      }
      
      const fileData = fs.readFileSync(filePath)
      zip.file(report.fileName, fileData)
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
