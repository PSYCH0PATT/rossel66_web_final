import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as fs from "fs"
import * as path from "path"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const report = await prisma.report.findUnique({ where: { id: params.id } })
    
    if (!report) {
      return NextResponse.json({ error: "Отчет не найден" }, { status: 404 })
    }
    
    // Удаляем файл если он существует
    if (report.filePath) {
      const filePath = path.join(process.cwd(), report.filePath)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`Удален файл: ${filePath}`)
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





