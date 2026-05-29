import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { reportFromPrisma } from "@/lib/storage-adapters"
import type { Report } from "@/lib/storage"
import { DASHBOARD_REVALIDATE_SEC } from "@/lib/cached-dashboard"

export type AdminReportItem = {
  id: string
  artistId: string | null
  artistName: string
  quarter: string
  year: number | null
  fileName: string
  uploadDate: string | null
  status: string | null
  isRegistered: boolean | null
  totalPlays: number | null
  totalAmount: number | null
  isSigned: boolean | null
  isPaid: boolean | null
}

function dedupeReportsByArtistQuarterYear<T extends Report>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.quarter}|${r.year}|${(r.artistName || "").trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadAdminReportsUncached(): Promise<AdminReportItem[]> {
  const rawReports = await prisma.report.findMany({
    where: { isRegistered: true },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      artistId: true,
      artistName: true,
      quarter: true,
      year: true,
      fileName: true,
      uploadDate: true,
      status: true,
      isRegistered: true,
      totalPlays: true,
      totalAmount: true,
      isSigned: true,
      isPaid: true,
      // skip heavy fields like filePath, processed, etc.
    },
  })

  const allReports = rawReports.map((r) => ({
    ...r,
    uploadedAt: null as string | null,
    filePath: null as string | null,
    processed: null as boolean | null,
    totalTracks: null as number | null,
  })) as unknown as Report[]

  const deduped = dedupeReportsByArtistQuarterYear(allReports)

  return deduped.map((r) => ({
    id: r.id,
    artistId: r.artistId ?? null,
    artistName: r.artistName,
    quarter: r.quarter,
    year: r.year ?? null,
    fileName: r.fileName,
    uploadDate: r.uploadDate ?? null,
    status: r.status ?? null,
    isRegistered: r.isRegistered ?? null,
    totalPlays: r.totalPlays ?? null,
    totalAmount: r.totalAmount ?? null,
    isSigned: r.isSigned ?? null,
    isPaid: r.isPaid ?? null,
  }))
}

export const getCachedAdminReports = unstable_cache(
  async () => loadAdminReportsUncached(),
  ["admin-reports-v1"],
  { revalidate: DASHBOARD_REVALIDATE_SEC }
)
