import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"

export async function GET() {
  try {
    const raw = await prisma.report.findMany({
      where: { isRegistered: false },
      orderBy: { uploadedAt: "desc" },
    })
    let unregisteredReports = raw.map(reportFromPrisma)

    const seen = new Set<string>()
    unregisteredReports = unregisteredReports.filter(r => {
      const key = `${r.quarter}|${r.year}|${(r.artistName || '').trim().toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ 
      reports: unregisteredReports.map(report => ({
        id: report.id,
        artistName: report.artistName,
        quarter: report.quarter,
        year: report.year,
        fileName: report.fileName,
        uploadDate: report.uploadDate,
        status: report.status,
        isRegistered: report.isRegistered,
        totalPlays: report.totalPlays,
        totalAmount: report.totalAmount,
      }))
    })
  } catch (error) {
    console.error("Ошибка при получении незарегистрированных отчетов:", error)
    return NextResponse.json(
      { error: "Ошибка при получении отчетов" },
      { status: 500 }
    )
  }
}