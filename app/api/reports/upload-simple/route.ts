import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import * as XLSX from 'xlsx'
import { z } from "zod"
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

const fieldsSchema = z.object({
  artistName: z.string().min(1).max(500),
  quarter: z.string().min(1).max(32),
  year: z.string().regex(/^\d{4}$/),
  totalAmount: z.string().max(64).optional(),
  totalPlays: z.string().max(64).optional(),
})

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const parsedFields = fieldsSchema.safeParse({
      artistName: String(formData.get("artistName") ?? ""),
      quarter: String(formData.get("quarter") ?? ""),
      year: String(formData.get("year") ?? ""),
      totalAmount: formData.get("totalAmount") != null ? String(formData.get("totalAmount")) : undefined,
      totalPlays: formData.get("totalPlays") != null ? String(formData.get("totalPlays")) : undefined,
    })
    if (!parsedFields.success || !file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json(
        {
          success: false,
          message: "Отсутствуют обязательные поля или неверный формат",
          issues: parsedFields.success ? undefined : parsedFields.error.flatten(),
        },
        { status: 400 }
      )
    }
    const { artistName, quarter, year, totalAmount, totalPlays } = parsedFields.data

    // Читаем Excel файл
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log('Данные из Excel файла:', data.slice(0, 3)) // Первые 3 строки для отладки

    // Пытаемся автоматически извлечь данные из файла
    let calculatedAmount = 0
    let calculatedPlays = 0

    if (data.length > 0) {
      // Ищем столбцы с суммами и прослушиваниями
      const firstRow = data[0] as any
      const keys = Object.keys(firstRow)
      
      // Пытаемся найти столбцы с числовыми данными
      for (const row of data) {
        for (const key of keys) {
          const value = (row as any)[key]
          if (typeof value === 'number') {
            // Если значение больше 1000, вероятно это прослушивания
            if (value > 1000) {
              calculatedPlays += value
            } else if (value > 0) {
              // Иначе это может быть сумма
              calculatedAmount += value
            }
          }
        }
      }
    }

    // Используем переданные значения или рассчитанные
    const finalAmount = totalAmount ? parseFloat(totalAmount) : calculatedAmount
    const finalPlays = totalPlays ? parseInt(totalPlays) : calculatedPlays

    const registeredArtist = await prisma.user.findFirst({
      where: {
        role: "artist",
        OR: [
          { name: { equals: artistName, mode: "insensitive" } },
          { username: { equals: artistName, mode: "insensitive" } },
        ],
      },
    })

    // Проверка дубликата
    if (registeredArtist) {
      const duplicateReport = await prisma.report.findFirst({
        where: { artistId: registeredArtist.id, quarter, year: parseInt(year) }
      })
      if (duplicateReport) {
        return NextResponse.json({
          success: false,
          message: `Отчёт для ${artistName} за ${quarter} ${parseInt(year)} уже существует`
        }, { status: 409 })
      }
    }

    // Создаем отчет
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Убеждаемся, что бакет существует
    await ensureBucketExists('reports')

    const cleanFileName = transliterate(file.name)
    const supabasePath = `${quarter}/${reportId}_${cleanFileName}`
    const fileBuffer = Buffer.from(buffer)

    // Загружаем в Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('reports')
      .upload(supabasePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`Failed to upload to Supabase: ${uploadError.message}`)
    }
    
    // Относительный путь для БД
    const relativeFilePath = supabasePath
    
    const newReport = await prisma.report.create({
      data: {
        id: reportId,
        artistId: registeredArtist?.id || null,
        artistName: artistName,
        quarter: quarter,
        year: parseInt(year),
        fileName: file.name,
        filePath: relativeFilePath,
        uploadDate: new Date().toISOString(),
        status: 'processed',
        totalPlays: finalPlays,
        totalAmount: finalAmount,
        isRegistered: !!registeredArtist,
        isSigned: false,
        isPaid: false,
        processed: true
      }
    })

    console.log('Создан новый отчет:', newReport)
    console.log('Файл сохранён:', relativeFilePath)

    return NextResponse.json({
      success: true,
      message: `Отчет успешно загружен! ${registeredArtist ? 'Артист найден в системе.' : 'Артист не зарегистрирован.'} Обработано ${data.length} треков.`,
      report: {
        id: reportId,
        artistName: artistName,
        isRegistered: !!registeredArtist,
        totalAmount: finalAmount,
        totalPlays: finalPlays,
        tracksCount: data.length
      }
    })

  } catch (error) {
    console.error('Ошибка при загрузке отчета:', error)
    return NextResponse.json({
      success: false,
      message: "Ошибка при обработке файла"
    }, { status: 500 })
  }
}
