import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = await requireAuth(request)
  if (denied) return denied

  try {
    const rows = await prisma.$queryRaw<{ quarter: string }[]>`
      SELECT DISTINCT quarter FROM "Report"
      WHERE quarter ~ '^Q[1-4]$'
      ORDER BY quarter ASC
    `
    const quarters = rows.map(r => r.quarter)

    /**
     * Счётчик обязан совпадать с тем, что покажет раскрытый квартал, иначе цифра
     * в свёрнутом виде снова будет врать. Поэтому здесь та же дедупликация, что
     * в /api/reports/list/[quarter]: один отчёт на (quarter, year, artistName).
     */
    const pairRows = await prisma.$queryRaw<{ quarter: string; year: number; count: number }[]>`
      SELECT quarter, year, COUNT(*)::int AS count FROM (
        SELECT DISTINCT ON (quarter, year, lower(trim(COALESCE("artistName", ''))))
          quarter, year
        FROM "Report"
        WHERE "isRegistered" = true
          AND year IS NOT NULL
          AND quarter ~ '^Q[1-4]$'
        ORDER BY quarter, year, lower(trim(COALESCE("artistName", ''))), "uploadedAt" DESC
      ) deduped
      GROUP BY quarter, year
      ORDER BY year DESC, quarter ASC
    `
    const quarterYearPairs = pairRows.map((r) => ({
      quarter: r.quarter,
      year: r.year,
      count: Number(r.count),
    }))

    const response = NextResponse.json({ quarters, quarterYearPairs })
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
    return response
  } catch (error) {
    console.error("Ошибка при получении списка кварталов:", error)
    return NextResponse.json(
      { error: `Ошибка при получении списка кварталов: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
