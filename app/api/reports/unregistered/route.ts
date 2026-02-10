import { NextResponse } from "next/server"
import { loadReports } from "@/lib/storage"

export async function GET() {
  try {
    const allReports = await loadReports()
    const unregisteredReports = allReports.filter(report => !report.isRegistered)
    
    
    return NextResponse.json({ 
      reports: unregisteredReports.map(report => ({
        id: report.id,
        artistName: report.artistName,
        quarter: report.quarter,
        year: report.year,
        fileName: report.fileName,
        uploadDate: report.uploadDate,
        status: report.status,
        isRegistered: report.isRegistered,
        totalPlays: report.totalPlays,
        totalAmount: report.totalAmount,
      }))
    })
  } catch (error) {
    console.error("Ошибка при получении незарегистрированных отчетов:", error)
    return NextResponse.json(
      { error: "Ошибка при получении отчетов" },
      { status: 500 }
    )
  }
}