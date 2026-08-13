import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth, requireSelfLinkedOrAdmin } from "@/lib/server-auth"
import { supabase } from "@/lib/supabase"

function getStoragePath(dbPath: string): string {
  const reportsIndex = dbPath.indexOf('reports/')
  if (reportsIndex !== -1) {
    return dbPath.substring(reportsIndex + 8)
  }
  const qMatch = dbPath.match(/(Q[1-4]\/.*)$/)
  if (qMatch) {
    return qMatch[1]
  }
  return dbPath
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const reportId = params.id

    const raw = await prisma.report.findUnique({ where: { id: reportId } })
    const report = raw ? reportFromPrisma(raw) : null

    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }

    // Главный профиль качает отчёты своих привязанных профилей (AKA).
    if (report.artistId) {
      const denied = await requireSelfLinkedOrAdmin(request, report.artistId)
      if (denied) return denied
    }

    if (!report.filePath) {
      return NextResponse.json({ error: "Путь к файлу не указан" }, { status: 404 })
    }

    // Извлекаем путь в бакете
    const storagePath = getStoragePath(report.filePath)

    // Скачиваем файл из Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('reports')
      .download(storagePath)

    if (downloadError || !fileBlob) {
      console.error("Ошибка скачивания файла из Supabase Storage:", downloadError)
      return NextResponse.json({ error: "Файл отчета не найден в хранилище" }, { status: 404 })
    }

    // Преобразуем Blob в Buffer
    const arrayBuffer = await fileBlob.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

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
