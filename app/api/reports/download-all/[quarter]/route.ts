import { NextResponse } from "next/server"
import JSZip from "jszip"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import type { Prisma } from "@prisma/client"
import { supabase } from "@/lib/supabase"
import { attachmentContentDisposition, uniqueArchiveName } from "@/lib/content-disposition"

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

export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const session = getSessionUser()!
    const quarter = params.quarter

    /**
     * QA5: раньше выборка шла по одному кварталу без года, поэтому архив за
     * «Q1 2026» собирал ещё и Q1 других лет. Год приходит из UI параметром.
     */
    const yearParam = new URL(request.url).searchParams.get("year")
    const year =
      yearParam !== null && yearParam !== "" && !Number.isNaN(Number(yearParam))
        ? Number(yearParam)
        : null

    const where: Prisma.ReportWhereInput = { quarter }
    if (year !== null) {
      where.year = year
    }
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
    // F9: JSZip молча перезаписывает запись с тем же именем — у тёзок в архив
    // попадал только последний отчёт. Ведём набор уже занятых имён.
    const usedNames = new Set<string>()
    let addedCount = 0

    // Добавляем файлы в архив
    for (const report of quarterReports) {
      if (!report.filePath) {
        console.warn(`Отчет ${report.id} не имеет пути к файлу`)
        continue
      }
      
      let fileData: Buffer
      const storagePath = getStoragePath(report.filePath)
      
      console.log(`Скачиваем отчет для ZIP из Supabase: ${storagePath}`)
      const { data, error } = await supabase.storage.from('reports').download(storagePath)
      
      if (error || !data) {
        console.warn(`Файл не найден в Supabase: ${storagePath}`, error?.message)
        continue
      }
      
      const arrayBuffer = await data.arrayBuffer()
      fileData = Buffer.from(arrayBuffer)
      
      zip.file(uniqueArchiveName(report.fileName, usedNames), new Uint8Array(fileData))
      addedCount++
    }

    if (addedCount === 0) {
      return NextResponse.json(
        { error: "Ни один файл отчёта не удалось скачать из хранилища" },
        { status: 404 }
      )
    }

    // Генерируем ZIP-архив
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // Отправляем архив клиенту
    const headers = new Headers()
    headers.set("Content-Type", "application/zip")
    headers.set("Content-Disposition", attachmentContentDisposition(
        year !== null ? `${quarter}_${year}_reports.zip` : `${quarter}_reports.zip`
      ))

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
