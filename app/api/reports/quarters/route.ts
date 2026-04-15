import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<{ quarter: string }[]>`
      SELECT DISTINCT quarter FROM "Report"
      WHERE quarter ~ '^Q[1-4]$'
      ORDER BY quarter ASC
    `
    const quarters = rows.map(r => r.quarter)

    const pairRows = await prisma.$queryRaw<{ quarter: string; year: number }[]>`
      SELECT DISTINCT quarter, year FROM "Report"
      WHERE "isRegistered" = true
        AND year IS NOT NULL
        AND quarter ~ '^Q[1-4]$'
      ORDER BY year DESC, quarter ASC
    `
    const quarterYearPairs = pairRows.map((r) => ({ quarter: r.quarter, year: r.year }))

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
