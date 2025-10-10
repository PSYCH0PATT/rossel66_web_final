import { NextResponse } from "next/server"
import { loadReports, loadUsers } from "@/lib/storage"

export async function GET() {
  try {
    const reports = loadReports()
    const users = loadUsers()
    
    // Создаем выплаты на основе отчетов
    const payments = reports
      .filter(report => report.isRegistered) // Только зарегистрированные артисты
      .map(report => {
        const artist = users.find(user => user.id === report.artistId)
        
        return {
          id: `payment_${report.id}`,
          reportId: report.id,
          artistId: report.artistId,
          artistName: artist ? artist.name : report.artistName,
          quarter: report.quarter,
          year: report.year,
          amount: report.totalAmount,
          date: report.uploadDate,
          isPaid: report.isPaid,
          isSigned: report.isSigned
        }
      })
      .sort((a, b) => {
        // Сортируем по году и кварталу (новые сначала)
        if (a.year !== b.year) {
          return b.year - a.year
        }
        const quarterA = parseInt(a.quarter.substring(1))
        const quarterB = parseInt(b.quarter.substring(1))
        return quarterB - quarterA
      })

    return NextResponse.json({ success: true, payments })
  } catch (error) {
    console.error('Ошибка при загрузке выплат:', error)
    return NextResponse.json({ success: false, error: 'Failed to load payments' }, { status: 500 })
  }
}





