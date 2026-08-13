import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { buildReportOrderBySql } from "@/lib/report-sort"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const PAGE_SIZES = new Set([20, 50, 100])

/**
 * Дедупликация как раньше в памяти: один отчёт на (quarter, year, artistName).
 * Пагинация по результату DISTINCT ON в PostgreSQL.
 */
export async function GET(request: Request, { params }: { params: { quarter: string } }) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied

    const sessionUser = getSessionUser()!
    const quarter = params.quarter
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const rawSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20
    const pageSize = PAGE_SIZES.has(rawSize) ? rawSize : 20
    const skip = (page - 1) * pageSize

    const yearParam = searchParams.get("year")
    const yearFilter =
      yearParam !== null && yearParam !== "" && !Number.isNaN(Number(yearParam))
        ? Number(yearParam)
        : null

    const artistFilter =
      sessionUser.role === "artist" ? Prisma.sql`AND "artistId" = ${sessionUser.id}` : Prisma.empty

    const yearSql =
      yearFilter !== null ? Prisma.sql`AND year = ${yearFilter}` : Prisma.empty

    // D3: серверный фильтр «неподписанные / неоплаченные», чтобы total и пагинация
    // соответствовали видимым строкам (раньше фильтр был page-local на клиенте).
    const statusFilter = searchParams.get("filter")
    const filterSql =
      statusFilter === "unsigned"
        ? Prisma.sql`AND "isSigned" IS NOT TRUE`
        : statusFilter === "unpaid"
          ? Prisma.sql`AND "isPaid" IS NOT TRUE`
          : statusFilter === "acknowledged_unsigned"
            ? Prisma.sql`AND "isAcknowledged" = true AND "isSigned" IS NOT TRUE`
            : Prisma.empty

    // Порядок задаётся белым списком в lib/report-sort — в SQL уходит выражение,
    // а не значение параметра.
    const orderBy = Prisma.raw(
      buildReportOrderBySql(
        searchParams.get("sort"),
        searchParams.get("dir"),
        `year DESC, "uploadedAt" DESC`
      )
    )

    const countRows = await prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT DISTINCT ON (year, lower(trim(COALESCE("artistName", '')))) id
          FROM "Report"
          WHERE quarter = ${quarter}
            AND "isRegistered" = true
            ${artistFilter}
            ${yearSql}
            ${filterSql}
          ORDER BY year DESC, lower(trim(COALESCE("artistName", ''))), "uploadedAt" DESC
        ) deduped
      `
    )
    const total = Number(countRows[0]?.c ?? 0)

    const idRows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM (
          SELECT DISTINCT ON (year, lower(trim(COALESCE("artistName", ''))))
            id, quarter, year, "artistName", "uploadedAt", "acknowledgedAt",
            "totalPlays", "totalAmount", "isAcknowledged", "isSigned", "isPaid"
          FROM "Report"
          WHERE quarter = ${quarter}
            AND "isRegistered" = true
            ${artistFilter}
            ${yearSql}
            ${filterSql}
          ORDER BY year DESC, lower(trim(COALESCE("artistName", ''))), "uploadedAt" DESC
        ) deduped
        ORDER BY ${orderBy}
        LIMIT ${pageSize} OFFSET ${skip}
      `
    )

    const ids = idRows.map((r) => r.id)
    if (ids.length === 0) {
      const response = NextResponse.json({
        reports: [],
        total,
        page,
        pageSize,
      })
      response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30")
      return response
    }

    const rawReports = await prisma.report.findMany({
      where: { id: { in: ids } },
    })
    const orderMap = new Map(ids.map((id, i) => [id, i]))
    rawReports.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

    const allReports = rawReports.map(reportFromPrisma)

    const response = NextResponse.json({ 
      reports: allReports.map((report) => ({
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
        isAcknowledged: report.isAcknowledged,
      })),
      total,
      page,
      pageSize,
    })
    
    response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30")
    return response
  } catch (error) {
    console.error("Ошибка при получении списка отчетов:", error)
    return NextResponse.json(
      { error: "Ошибка при получении списка отчетов" },
      { status: 500 }
    )
  }
}
