import { NextResponse } from "next/server"
import * as path from "path"
import { findArtistByName } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import { supabase, ensureBucketExists } from "@/lib/supabase"

function transliterate(text: string): string {
  const ru: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 
    'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 
    'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 
    'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 
    'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  }
  return text.split('').map(char => ru[char] ?? char).join('')
}

export async function POST(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const quarter = formData.get("quarter") as string

    if (!quarter) {
      return NextResponse.json({ error: "Не указан квартал" }, { status: 400 })
    }

    // Убеждаемся, что бакет существует
    await ensureBucketExists('reports')

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

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const cleanFileName = transliterate(fileName)
      const supabasePath = `${quarter}/${cleanFileName}`

      // Загружаем в Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(supabasePath, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: true
        })

      if (uploadError) {
        throw new Error(`Failed to upload to Supabase: ${uploadError.message}`)
      }

      counter++
      const reportId = `r${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}`
      const relativeFilePath = supabasePath

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
