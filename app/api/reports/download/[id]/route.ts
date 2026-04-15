import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import * as fs from "fs"
import * as path from "path"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const raw = await prisma.report.findUnique({ where: { id: params.id } })
    const report = raw ? reportFromPrisma(raw) : null
    
    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }

    if (!report.filePath) {
      return NextResponse.json({ error: "Путь к файлу отчета не указан" }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), report.filePath)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Файл отчета не найден" }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
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