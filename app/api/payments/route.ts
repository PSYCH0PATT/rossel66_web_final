import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"

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
    const artistIdFilter = searchParams.get("artistId")?.trim()

    const baseWhere: {
      isRegistered: true
      artistId?: string
    } = { isRegistered: true as const }
    if (artistIdFilter) {
      baseWhere.artistId = artistIdFilter
    }
    const unpaidClause: { OR: Array<{ isPaid: false } | { isPaid: null }> } = {
      OR: [{ isPaid: false }, { isPaid: null }],
    }
    const where = {
      ...baseWhere,
      ...(unpaidOnly ? unpaidClause : {}),
    }

    const skip = (page - 1) * pageSize

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
        where: { isRegistered: true, ...unpaidClause },
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
