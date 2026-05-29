import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
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

export async function DELETE(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const quarter = searchParams.get("quarter")
    const yearParam = searchParams.get("year")
    const year = yearParam ? parseInt(yearParam, 10) : null

    if (!quarter || !/^Q[1-4]$/.test(quarter)) {
      return NextResponse.json(
        { error: "Укажите квартал (Q1, Q2, Q3 или Q4)" },
        { status: 400 }
      )
    }

    const where = year !== null && !isNaN(year)
      ? { quarter, year }
      : { quarter }

    const reports = await prisma.report.findMany({ where })

    // Собираем пути к файлам для удаления из хранилища
    const filesToRemove: string[] = []
    for (const report of reports) {
      if (report.filePath) {
        filesToRemove.push(getStoragePath(report.filePath))
      }
    }

    if (filesToRemove.length > 0) {
      console.log(`Удаляем файлы из Supabase Storage:`, filesToRemove)
      const { error: removeError } = await supabase.storage
        .from('reports')
        .remove(filesToRemove)
      
      if (removeError) {
        console.error("Ошибка при пакетном удалении файлов из Supabase Storage:", removeError)
      } else {
        console.log(`Успешно удалено файлов из Supabase Storage: ${filesToRemove.length}`)
      }
    }

    const result = await prisma.report.deleteMany({ where })
    const deletedCount = result.count

    console.log(`Удалено отчетов за ${quarter}${year !== null ? ` ${year}` : ""}: ${deletedCount}`)

    return NextResponse.json({
      success: true,
      message: `Удалено отчетов: ${deletedCount}`,
      deletedCount,
    })
  } catch (error) {
    console.error("Ошибка при удалении отчетов квартала:", error)
    return NextResponse.json(
      { error: "Ошибка при удалении отчетов квартала" },
      { status: 500 }
    )
  }
}

