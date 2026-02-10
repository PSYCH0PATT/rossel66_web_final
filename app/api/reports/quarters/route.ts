import { NextResponse } from "next/server"
import { loadReports } from "@/lib/storage"

export async function GET() {
  try {
    const reports = await loadReports()
    
    // Получаем уникальные кварталы из отчетов
    const quarterSet = new Set<string>()
    reports.forEach(report => {
      quarterSet.add(report.quarter)
    })
    
    const quarters = Array.from(quarterSet)
      .filter(quarter => /^Q[1-4]$/.test(quarter)) // Фильтруем только Q1, Q2, Q3, Q4
      .sort() // Сортируем по алфавиту
    
    const response = NextResponse.json({ quarters })
    // Отключаем кеширование
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error("Ошибка при получении списка кварталов:", error)
    return NextResponse.json(
      { error: `Ошибка при получении списка кварталов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
