import { NextResponse } from "next/server"
import { loadReports } from "@/lib/storage"

export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const quarter = params.quarter
    const allReports = await loadReports()
    
    // Получаем только зарегистрированные отчеты для выбранного квартала
    const registeredReports = allReports.filter(report => 
      report.quarter === quarter && report.isRegistered
    )
    
    
    const response = NextResponse.json({ 
      reports: registeredReports.map(report => ({
        id: report.id,
        artistId: report.artistId,
        artistName: report.artistName,
        quarter: report.quarter,
        year: report.year,
        fileName: report.fileName,
        uploadDate: report.uploadDate,
        status: report.status,
        isRegistered: report.isRegistered,
        totalPlays: report.totalPlays,
        totalAmount: report.totalAmount,
        isSigned: report.isSigned,
        isPaid: report.isPaid,
      }))
    })
    
    // Отключаем кеширование
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error("Ошибка при получении списка отчетов:", error)
    return NextResponse.json(
      { error: "Ошибка при получении списка отчетов" },
      { status: 500 }
    )
  }
}
