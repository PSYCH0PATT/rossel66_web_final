import { NextResponse } from "next/server"
import { updateReportSignedStatus, updateReportPaidStatus, addActivity } from "@/lib/storage"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { requireAdmin, getSessionUser } from "@/lib/server-auth"

export async function PUT(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const sessionUser = getSessionUser()!

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

    const rawReport = await prisma.report.findUnique({ where: { id: reportId } })
    const report = rawReport ? reportFromPrisma(rawReport) : null
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }
    
    if (statusType === 'signed') {
      console.log(`API: Обновляем статус подписи для отчета ${reportId}`)
      success = await updateReportSignedStatus(reportId, value)
      if (success) {
        // Аудит-лог подписания
        await addActivity({
          type: 'report_status_changed',
          userId: sessionUser.id,
          userRole: 'admin',
          title: value ? 'Отчёт подписан' : 'Подпись отчёта снята',
          description: `Отчёт ${report.artistName} (${report.quarter} ${report.year}): isSigned → ${value}`,
          metadata: { reportId, artistId: report.artistId, changedBy: sessionUser.id, field: 'isSigned', newValue: value }
        })
      }
    } else if (statusType === 'paid') {
      console.log(`API: Обновляем статус выплаты для отчета ${reportId}`)
      success = await updateReportPaidStatus(reportId, value)
      if (success) {
        // Аудит-лог выплаты
        await addActivity({
          type: 'report_status_changed',
          userId: sessionUser.id,
          userRole: 'admin',
          title: value ? 'Выплата отмечена' : 'Выплата отменена',
          description: `Отчёт ${report.artistName} (${report.quarter} ${report.year}): isPaid → ${value}`,
          metadata: { reportId, artistId: report.artistId, changedBy: sessionUser.id, field: 'isPaid', newValue: value }
        })
        if (value === true && report.artistId) {
          await addActivity({
            type: 'payment_sent',
            userId: report.artistId,
            userRole: 'artist',
            title: 'Выплата отправлена',
            description: `Отмечена выплата по отчёту за ${report.quarter} ${report.year}`,
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
