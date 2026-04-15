import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const reportId = params.id

    const raw = await prisma.report.findUnique({ where: { id: reportId } })
    const report = raw ? reportFromPrisma(raw) : null

    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }

    if (!report.filePath) {
      return NextResponse.json({ error: "Путь к файлу не указан" }, { status: 404 })
    }

    // Формируем полный путь к файлу
    const filePath = path.join(process.cwd(), report.filePath)

    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Файл отчета не найден" }, { status: 404 })
    }

    // Читаем файл с использованием Node.js fs
    const fileBuffer = fs.readFileSync(filePath)

    // Парсим Excel-файл
    const workbook = XLSX.read(fileBuffer, { type: "buffer" })

    // Получаем список листов
    const sheetNames = workbook.SheetNames

    // Подготавливаем данные для предварительного просмотра
    const previewData: Record<string, any> = {}

    // Ограничиваем количество строк для предварительного просмотра
    const MAX_ROWS = 50

    // Обрабатываем каждый лист
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName]

      // Преобразуем лист в JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      // Ограничиваем количество строк
      const limitedData = jsonData.slice(0, MAX_ROWS)

      previewData[sheetName] = limitedData
    }

    return NextResponse.json({
      success: true,
      fileName: report.fileName,
      sheetNames,
      previewData,
    })
  } catch (error) {
    console.error("Ошибка при получении предварительного просмотра отчета:", error)
    return NextResponse.json(
      {
        error: `Ошибка при получении предварительного просмотра отчета: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
