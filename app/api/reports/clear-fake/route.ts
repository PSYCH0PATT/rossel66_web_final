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

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    // Находим фейковые отчеты (незарегистрированные артисты)
    const fakeReports = await prisma.report.findMany({
      where: {
        isRegistered: false
      }
    })

    let deletedCount = 0
    const filesToRemove: string[] = []
    
    // Удаляем фейковые отчеты и их файлы
    for (const report of fakeReports) {
      if (report.filePath) {
        filesToRemove.push(getStoragePath(report.filePath))
      }
    }

    if (filesToRemove.length > 0) {
      console.log(`Удаляем фейковые файлы из Supabase Storage:`, filesToRemove)
      const { error: removeError } = await supabase.storage
        .from('reports')
        .remove(filesToRemove)
      
      if (removeError) {
        console.error("Ошибка при пакетном удалении фейковых файлов из Supabase Storage:", removeError)
      } else {
        console.log(`Успешно удалено фейковых файлов из Supabase Storage: ${filesToRemove.length}`)
      }
    }

    // Удаляем записи из БД
    for (const report of fakeReports) {
      await prisma.report.delete({ where: { id: report.id } })
      deletedCount++
    }

    // Считаем оставшиеся отчеты
    const remainingCount = await prisma.report.count()

    return NextResponse.json({
      success: true,
      message: `Удалено ${deletedCount} фейковых отчетов`,
      remainingReports: remainingCount,
    })
  } catch (error) {
    console.error("Ошибка при удалении фейковых отчетов:", error)
    return NextResponse.json(
      { error: `Ошибка при удалении фейковых отчетов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
