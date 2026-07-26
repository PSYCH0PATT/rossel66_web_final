import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import { supabase } from "@/lib/supabase"
import { attachmentContentDisposition } from "@/lib/content-disposition"

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

    const raw = await prisma.report.findUnique({ where: { id: params.id } })
    const report = raw ? reportFromPrisma(raw) : null
    
    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }

    if (
      session.role !== "admin" &&
      report.artistId &&
      report.artistId !== session.id
    ) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
    }

    if (!report.filePath) {
      return NextResponse.json({ error: "Путь к файлу отчета не указан" }, { status: 404 })
    }

    let fileBuffer: Buffer

    const storagePath = getStoragePath(report.filePath)

    console.log(`Запрос файла из Supabase Storage: ${storagePath}`)
    const { data, error } = await supabase.storage.from('reports').download(storagePath)
    
    if (error || !data) {
      console.error(`Ошибка скачивания из Supabase (${storagePath}):`, error)
      return NextResponse.json({ error: "Файл отчета не найден" }, { status: 404 })
    }

    const arrayBuffer = await data.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // F9: без filename*=UTF-8'' браузер сохранял файл как «%D0%98%D0%BC%D1%8F.xlsx»
        'Content-Disposition': attachmentContentDisposition(report.fileName),
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("Ошибка при скачивании отчета:", error)
    return NextResponse.json(
      { error: "Ошибка при скачивании отчета" },
      { status: 500 }
    )
  }
}