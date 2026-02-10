import { NextResponse } from "next/server"
import { updateReportSignedStatus, updateReportPaidStatus, loadReports, addActivity } from "@/lib/storage"

export async function PUT(request: Request) {
  try {
    const { reportId, statusType, value } = await request.json()
    
    console.log(`API: Получен запрос на обновление статуса:`, { reportId, statusType, value })
    
    if (!reportId || !statusType || typeof value !== 'boolean') {
      console.log(`API: Неверные параметры запроса`)
      return NextResponse.json(
        { error: "reportId, statusType, and value are required" },
        { status: 400 }
      )
    }

    let success = false
    
    if (statusType === 'signed') {
      console.log(`API: Обновляем статус подписи для отчета ${reportId}`)
      success = await updateReportSignedStatus(reportId, value)
    } else if (statusType === 'paid') {
      console.log(`API: Обновляем статус выплаты для отчета ${reportId}`)
      success = await updateReportPaidStatus(reportId, value)
      if (success && value === true) {
        const reports = await loadReports()
        const report = reports.find(r => r.id === reportId)
        if (report?.artistId) {
          await addActivity({
            type: 'payment_sent',
            userId: report.artistId,
            userRole: 'artist',
            title: 'Выплата отправлена',
            description: 'Отмечена выплата по отчёту',
            metadata: { reportId, artistId: report.artistId }
          })
        }
      }
    } else {
      console.log(`API: Неверный тип статуса: ${statusType}`)
      return NextResponse.json(
        { error: "statusType must be 'signed' or 'paid'" },
        { status: 400 }
      )
    }

    if (!success) {
      console.log(`API: Отчет ${reportId} не найден`)
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    console.log(`API: Статус ${statusType} успешно обновлен для отчета ${reportId}`)
    return NextResponse.json({
      success: true,
      message: `Report ${statusType} status updated successfully`
    })
  } catch (error) {
    console.error("API: Ошибка при обновлении статуса отчета:", error)
    return NextResponse.json(
      { error: "Error updating report status" },
      { status: 500 }
    )
  }
}
