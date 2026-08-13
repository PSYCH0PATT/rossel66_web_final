import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/server-auth"
import { reportFromPrisma } from "@/lib/storage-adapters"
import { buildReportOrderBySql } from "@/lib/report-sort"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const PAGE_SIZES = new Set([20, 50, 100])

/** По умолчанию сверху те, кто ознакомился раньше всех — они ждут дольше всех. */
const DEFAULT_ORDER = `"acknowledgedAt" ASC NULLS LAST, "uploadedAt" ASC`

/**
 * Очередь на подпись: артист отчёт открыл и подтвердил ознакомление, а подписи
 * админа ещё нет. Раньше такие строки приходилось выискивать глазами по всем
 * кварталам — здесь они собраны в один плоский список.
 *
 * Дедупликация как в списке по кварталу, но ключ включает quarter: выборка идёт
 * по всем кварталам сразу.
 */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const rawSize = parseInt(searchParams.get("pageSize") || "20", 10) || 20
    const pageSize = PAGE_SIZES.has(rawSize) ? rawSize : 20
    const skip = (page - 1) * pageSize

    const orderBy = Prisma.raw(
      buildReportOrderBySql(searchParams.get("sort"), searchParams.get("dir"), DEFAULT_ORDER)
    )

    const where = Prisma.sql`
      WHERE "isRegistered" = true
        AND "isAcknowledged" = true
        AND "isSigned" IS NOT TRUE
    `

    const dedupKey = Prisma.sql`(quarter, year, lower(trim(COALESCE("artistName", ''))))`
    const dedupOrder = Prisma.sql`quarter, year, lower(trim(COALESCE("artistName", ''))), "uploadedAt" DESC`

    const countRows = await prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c FROM (
          SELECT DISTINCT ON ${dedupKey} id
          FROM "Report"
          ${where}
          ORDER BY ${dedupOrder}
        ) deduped
      `
    )
    const total = Number(countRows[0]?.c ?? 0)

    const idRows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM (
          SELECT DISTINCT ON ${dedupKey}
            id, quarter, year, "artistName", "uploadedAt", "acknowledgedAt",
            "totalPlays", "totalAmount", "isAcknowledged", "isSigned", "isPaid"
          FROM "Report"
          ${where}
          ORDER BY ${dedupOrder}
        ) deduped
        ORDER BY ${orderBy}
        LIMIT ${pageSize} OFFSET ${skip}
      `
    )

    const ids = idRows.map((r) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({ reports: [], total, page, pageSize })
    }

    const rawReports = await prisma.report.findMany({ where: { id: { in: ids } } })
    const orderMap = new Map(ids.map((id, i) => [id, i]))
    rawReports.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))

    return NextResponse.json({
      reports: rawReports.map(reportFromPrisma).map((report) => ({
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
        acknowledgedAt: report.acknowledgedAt ?? null,
      })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Ошибка при получении очереди на подпись:", error)
    return NextResponse.json({ error: "Ошибка при получении очереди на подпись" }, { status: 500 })
  }
}
