import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const session = getSessionUser()!
    const quarter = params.quarter

    const where: Prisma.ReportWhereInput = { quarter }
    if (session.role === "artist") {
      where.artistId = session.id
    }

    const raw = await prisma.report.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
    })
    const quarterReports = raw.map(reportFromPrisma)

    if (quarterReports.length === 0) {
      return NextResponse.json({ error: "Нет отчетов за выбранный квартал" }, { status: 404 })
    }

    // Создаем ZIP-архив
    const zip = new JSZip()

    // Добавляем файлы в архив
    for (const report of quarterReports) {
      if (!report.filePath) {
        console.warn(`Отчет ${report.id} не имеет пути к файлу`)
        continue
      }
      
      const filePath = path.join(process.cwd(), report.filePath)
      
      if (!fs.existsSync(filePath)) {
        console.warn(`Файл не найден: ${filePath}`)
        continue
      }
      
      const fileData = fs.readFileSync(filePath)
      zip.file(report.fileName, new Uint8Array(fileData))
    }

    // Генерируем ZIP-архив
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // Отправляем архив клиенту
    const headers = new Headers()
    headers.set("Content-Type", "application/zip")
    headers.set("Content-Disposition", `attachment; filename="${quarter}_reports.zip"`)

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Ошибка при скачивании отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при скачивании отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
