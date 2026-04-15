import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { findArtistByName } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"

// Директория для сохранения отчетов
const REPORTS_DIR = path.join(process.cwd(), "uploads", "reports")

export async function POST(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

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
      const baseName = name.split(/[/\\]/).pop() || name
      return baseName
        .replace(/\.\./g, '')
        .replace(/[<>:"|?*]/g, '')
        .replace(/^\.+/, '')
        .trim()
    }

    const year = new Date().getFullYear()
    const savedFiles = []
    const errors = []
    let counter = 0

    for (const file of files) {
      const fileName = sanitizeFileName(file.name)
      if (!fileName) {
        console.warn('Пропущен файл с недопустимым именем:', file.name)
        continue
      }

      // Извлекаем имя артиста из имени файла (часть до первого "_" или расширения)
      const nameWithoutExt = path.basename(fileName, path.extname(fileName))
      const artistNameFromFile = nameWithoutExt.split("_")[0].trim()

      // Резолвим реальный artistId по имени
      const artistUser = await findArtistByName(artistNameFromFile)
      if (!artistUser) {
        errors.push({
          fileName,
          error: `Артист "${artistNameFromFile}" не найден в системе`,
        })
        // Продолжаем, но сохраняем без artistId (неназначенный)
      }

      const resolvedArtistId = artistUser?.id || null
      const resolvedArtistName = artistUser?.name || artistNameFromFile

      // Проверяем дубликат: (artistId + quarter + year) — только для найденных артистов
      if (resolvedArtistId) {
        const existing = await prisma.report.findFirst({
          where: { artistId: resolvedArtistId, quarter, year }
        })
        if (existing) {
          errors.push({
            fileName,
            error: `Отчёт для ${resolvedArtistName} за ${quarter} ${year} уже существует`,
          })
          continue
        }
      }

      const filePath = path.join(quarterDir, fileName)
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      fs.writeFileSync(filePath, buffer)

      counter++
      const reportId = `r${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}`
      const relativeFilePath = `uploads/reports/${quarter}/${fileName}`

      await prisma.report.create({
        data: {
          id: reportId,
          artistId: resolvedArtistId,
          artistName: resolvedArtistName,
          quarter,
          year,
          fileName,
          filePath: relativeFilePath,
          uploadDate: new Date().toISOString(),
          status: "processed",
          totalPlays: 0,
          totalAmount: 0,
          isRegistered: !!resolvedArtistId,
          isSigned: false,
          isPaid: false,
          processed: true,
        }
      })

      savedFiles.push({
        name: fileName,
        artistName: resolvedArtistName,
        artistId: resolvedArtistId,
        isRegistered: !!resolvedArtistId,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Сохранено ${savedFiles.length} файлов в папку ${quarter}`,
      savedFiles,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Ошибка при сохранении отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при сохранении отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
