import { NextResponse } from "next/server"
import { loadReports, saveReports } from "@/lib/storage"
import * as fs from "fs"
import * as path from "path"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const reports = loadReports()
    const reportIndex = reports.findIndex(r => r.id === params.id)
    
    if (reportIndex === -1) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }

    const report = reports[reportIndex]
    
    // Удаляем файл если он существует
    if (report.filePath) {
      const filePath = path.join(process.cwd(), report.filePath)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`Удален файл: ${filePath}`)
      }
    }

    // Удаляем запись из массива
    reports.splice(reportIndex, 1)
    saveReports(reports)

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





