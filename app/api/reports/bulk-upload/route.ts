import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import * as XLSX from "xlsx"

// Директория для сохранения отчетов
const REPORTS_DIR = path.join(process.cwd(), "uploads", "reports")

export async function POST(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const quarter = formData.get("quarter") as string
    const files = formData.getAll("files") as File[]

    if (!quarter) {
      return NextResponse.json({ error: "Не указан квартал" }, { status: 400 })
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Нет файлов для загрузки" }, { status: 400 })
    }

    // Создаем директорию для квартала, если её нет
    const quarterDir = path.join(REPORTS_DIR, quarter)
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true })
    }
    if (!fs.existsSync(quarterDir)) {
      fs.mkdirSync(quarterDir, { recursive: true })
    }

    const artists = await prisma.user.findMany({
      where: { role: "artist" },
      select: { id: true, name: true },
    })
    const artistsMap = new Map<string, string>()
    for (const user of artists) {
      artistsMap.set(user.name.toLowerCase(), user.id)
    }

    // Обрабатываем каждый файл
    const processedFiles = []
    const errors = []
    const year = new Date().getFullYear()

    for (const file of files) {
      try {
        // Получаем имя файла без расширения
        const fileName = file.name
        const artistNameFromFile = path.basename(fileName, path.extname(fileName)).toLowerCase()

        // Ищем ID артиста по отображаемому имени
        const artistId = artistsMap.get(artistNameFromFile)

        if (!artistId) {
          errors.push({
            fileName,
            error: `Не найден артист с именем "${artistNameFromFile}"`,
          })
          continue
        }

        // Сохраняем файл в директорию квартала
        const filePath = path.join(quarterDir, fileName)
        const arrayBuffer = await file.arrayBuffer()
        fs.writeFileSync(filePath, new Uint8Array(arrayBuffer))

        // Анализируем файл для получения дополнительной информации
        const workbook = XLSX.read(arrayBuffer)
        let totalPlays = 0
        let totalAmount = 0

        // Пытаемся найти лист с данными артиста
        const dataSheet = workbook.SheetNames.find((name) => name !== "Итог") || workbook.SheetNames[0]
        if (dataSheet) {
          const worksheet = workbook.Sheets[dataSheet]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

          // Ищем итоговую строку
          const totalRow = jsonData.find((row) => row["Код"] === "Итого" || row[0] === "Итого")
          if (totalRow) {
            totalPlays = Number(totalRow["Количество"] ?? totalRow[4] ?? 0)
            totalAmount = Number(totalRow["Сумма, руб."] ?? totalRow[5] ?? 0)
          }
        }

        // Проверка дубликата
        const existing = await prisma.report.findFirst({
          where: { artistId, quarter, year }
        })
        if (existing) {
          errors.push({ fileName, error: `Отчёт для этого артиста за ${quarter} ${year} уже существует` })
          continue
        }

        // Создаем запись отчета с правильным ID артиста
        const reportId = `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const artistRow = await prisma.user.findUnique({
          where: { id: artistId },
          select: { name: true },
        })

        // Относительный путь для БД
        const relativeFilePath = `uploads/reports/${quarter}/${fileName}`
        
        // Сохраняем отчёт в БД
        await prisma.report.create({
          data: {
            id: reportId,
            artistId: artistId,
            artistName: artistRow?.name || artistNameFromFile,
            quarter: quarter,
            year: year,
            fileName: fileName,
            filePath: relativeFilePath,
            uploadDate: new Date().toISOString(),
            status: "processed",
            totalPlays: totalPlays,
            totalAmount: totalAmount,
            isRegistered: true,
            isSigned: false,
            isPaid: false,
            processed: true,
          }
        })

        processedFiles.push({
          name: fileName,
          artist: artistRow?.name || artistNameFromFile,
          artistId,
        })
      } catch (error) {
        console.error(`Ошибка при обработке файла ${file.name}:`, error)
        errors.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Возвращаем простой объект с информацией о загруженных файлах
    return NextResponse.json({
      success: true,
      message: `Загружено ${processedFiles.length} файлов в папку ${quarter}`,
      processedFiles: processedFiles.length,
      fileNames: processedFiles.map((file) => file.name),
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Ошибка при массовой загрузке отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при массовой загрузке отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
