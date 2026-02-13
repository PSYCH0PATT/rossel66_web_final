import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as fs from "fs"
import * as path from "path"

export async function GET() {
  try {
    // Находим фейковые отчеты (незарегистрированные артисты)
    const fakeReports = await prisma.report.findMany({
      where: {
        isRegistered: false
      }
    })

    let deletedCount = 0
    
    // Удаляем фейковые отчеты и их файлы
    for (const report of fakeReports) {
      // Удаляем файл если существует
      if (report.filePath) {
        const filePath = path.join(process.cwd(), report.filePath)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`Удален файл: ${filePath}`)
        }
      }
      
      // Удаляем запись из БД
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
