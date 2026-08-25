import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import { unpaidReportWhere } from "@/lib/payments-filter"

export const dynamic = "force-dynamic"

const ALLOWED_PAGE_SIZES = new Set([20, 50, 100])

export async function GET(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const rawPs = parseInt(searchParams.get("pageSize") || "20", 10)
    const pageSize = ALLOWED_PAGE_SIZES.has(rawPs) ? rawPs : 20
    const unpaidOnly = searchParams.get("unpaidOnly") === "true"
    // 0-а: объединённому экрану «Отчёты» нужны только два числа — «Невыплаченных»
    // в StatCard и счётчик на чипе. Строки для них не нужны.
    const countsOnly = searchParams.get("countsOnly") === "1"
    const artistIdFilter = searchParams.get("artistId")?.trim()

    const baseWhere: {
      isRegistered: true
      artistId?: string
    } = { isRegistered: true as const }
    if (artistIdFilter) {
      baseWhere.artistId = artistIdFilter
    }
    // F-69: нулевые суммы — не долг, они не попадают ни в список
    // «Невыплаченные», ни в счётчик над ним.
    const unpaidClause = unpaidReportWhere()
    const where = {
      ...baseWhere,
      ...(unpaidOnly ? unpaidClause : {}),
    }

    const skip = (page - 1) * pageSize

    if (countsOnly) {
      const [total, unpaidTotal] = await Promise.all([
        prisma.report.count({ where: baseWhere }),
        prisma.report.count({ where: { ...baseWhere, ...unpaidClause } }),
      ])
      return NextResponse.json({ success: true, payments: [], total, unpaidTotal })
    }

    const [reports, total, unpaidTotal] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          artistId: true,
          artistName: true,
          quarter: true,
          year: true,
          totalAmount: true,
          isPaid: true,
          isSigned: true,
          uploadDate: true,
        },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.report.count({ where }),
      prisma.report.count({
        // D4: счётчик неоплаченных должен учитывать фильтр по артисту (baseWhere),
        // иначе при выбранном артисте показывает глобальное число неоплаченных.
        where: { ...baseWhere, ...unpaidClause },
      }),
    ])

    const payments = reports.map((report) => ({
      id: `payment_${report.id}`,
      reportId: report.id,
      artistId: report.artistId,
      artistName: report.artistName,
      quarter: report.quarter,
      year: report.year,
      amount: report.totalAmount,
      date: report.uploadDate,
      isPaid: report.isPaid,
      isSigned: report.isSigned,
    }))

    return NextResponse.json({
      success: true,
      payments,
      total,
      page,
      pageSize,
      unpaidTotal,
    })
  } catch (error) {
    console.error("Ошибка при загрузке выплат:", error)
    return NextResponse.json(
      { success: false, error: "Failed to load payments" },
      { status: 500 }
    )
  }
}
