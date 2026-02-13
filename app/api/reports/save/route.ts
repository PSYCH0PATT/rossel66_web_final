import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { prisma } from "@/lib/prisma"

// Директория для сохранения отчетов
const REPORTS_DIR = path.join(process.cwd(), "uploads", "reports")

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

    // Функция для санитизации имени файла (защита от path traversal)
    const sanitizeFileName = (name: string): string => {
      // Убираем путь и оставляем только имя файла
      const baseName = name.split(/[/\\]/).pop() || name
      // Убираем опасные символы и последовательности
      return baseName
        .replace(/\.\./g, '') // Убираем ..
        .replace(/[<>:"|?*]/g, '') // Убираем недопустимые символы Windows
        .replace(/^\.+/, '') // Убираем точки в начале
        .trim()
    }

    // Сохраняем каждый файл
    const savedFiles = []
    for (const file of files) {
      const fileName = sanitizeFileName(file.name)
      if (!fileName) {
        console.warn('Пропущен файл с недопустимым именем:', file.name)
        continue
      }
      const filePath = path.join(quarterDir, fileName)

      // Преобразуем File в Buffer и сохраняем
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      fs.writeFileSync(filePath, buffer)

      savedFiles.push({
        name: fileName,
        path: filePath,
      })

      // Добавляем информацию о файле в БД
      const artistId = fileName.split("_")[0]
      const reportId = `r${Date.now()}-${artistId}`
      const year = new Date().getFullYear()
      
      // Относительный путь для БД
      const relativeFilePath = `uploads/reports/${quarter}/${fileName}`

      await prisma.report.create({
        data: {
          id: reportId,
          artistId: artistId || null,
          artistName: artistId, // Используем artistId как имя, так как из имени файла сложно получить полное имя
          quarter: quarter,
          year: year,
          fileName: fileName,
          filePath: relativeFilePath,
          uploadDate: new Date().toISOString(),
          status: "processed",
          totalPlays: 0, // Эти данные будут обновлены при запросе отчета
          totalAmount: 0,
          isRegistered: true,
          isSigned: false,
          isPaid: false,
          processed: true,
        }
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
