import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import * as fs from "fs"
import * as path from "path"
import { getSessionUser, requireAuth } from "@/lib/server-auth"

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

    const filePath = path.join(process.cwd(), report.filePath)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Файл отчета не найден" }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${report.fileName}"`,
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