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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  try {
    const report = await prisma.report.findUnique({ where: { id: params.id } })
    
    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }
    
    // Удаляем файл из Supabase Storage
    if (report.filePath) {
      const storagePath = getStoragePath(report.filePath)
      const { error: removeError } = await supabase.storage
        .from('reports')
        .remove([storagePath])

      if (removeError) {
        console.error(`Ошибка при удалении файла из Supabase Storage (${storagePath}):`, removeError)
      } else {
        console.log(`Удален файл из Supabase Storage: ${storagePath}`)
      }
    }

    // Удаляем запись из БД
    await prisma.report.delete({ where: { id: params.id } })

    console.log(`Удален отчет: ${report.artistName} (${report.quarter} ${report.year})`)

    return NextResponse.json({ 
      success: true, 
      message: "Отчет успешно удален" 
    })
  } catch (error) {
    console.error("Ошибка при удалении отчета:", error)
    return NextResponse.json(
      { error: "Ошибка при удалении отчета" },
      { status: 500 }
    )
  }
}

