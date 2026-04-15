import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import * as fs from "fs"
import * as path from "path"

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

    for (const report of reports) {
      if (report.filePath) {
        const filePath = path.join(process.cwd(), report.filePath)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          console.log(`Удален файл: ${filePath}`)
        }
      }
    }

    const result = await prisma.report.deleteMany({ where })
    const deletedCount = result.count

    // Удаляем папку квартала, если она пустая (data/reports/{quarter} или uploads/reports/{quarter})
    const possibleDirs = [
      path.join(process.cwd(), "data", "reports", quarter),
      path.join(process.cwd(), "uploads", "reports", quarter),
    ]
    for (const dir of possibleDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        try {
          const entries = fs.readdirSync(dir)
          if (entries.length === 0) {
            fs.rmdirSync(dir)
            console.log(`Удалена пустая папка: ${dir}`)
          }
        } catch {
          // игнорируем ошибки удаления папки
        }
      }
    }

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
