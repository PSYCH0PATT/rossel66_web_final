import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import { getBuildinDatabaseId } from "@/lib/buildin/env"

export const dynamic = "force-dynamic"

/**
 * Optional: publish a periodic KPI snapshot page into Buildin activity DB
 * (aggregates only — never raw StreamAnalytics rows).
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  if (!getBuildinDatabaseId("activity")) {
    return NextResponse.json(
      { error: "BUILDIN_DB_ACTIVITY not configured; KPI snapshots skipped" },
      { status: 503 }
    )
  }

  const [artists, releases, reportsUnpaid, playlists, submissionsOpen] = await Promise.all([
    prisma.user.count({ where: { role: "artist" } }),
    prisma.release.count(),
    prisma.report.count({ where: { isPaid: false } }),
    prisma.playlist.count(),
    prisma.formSubmission.count({
      where: { status: { in: ["pending", "partial", "dual_writing"] } },
    }),
  ])

  const snapshot = {
    at: new Date().toISOString(),
    artists,
    releases,
    reportsUnpaid,
    playlists,
    submissionsOpen,
  }

  const id = `kpi_${Date.now()}`
  await enqueueBuildinOutbox({
    eventType: "sync_activity",
    payload: {
      id,
      type: "kpi_snapshot",
      userId: "system",
      userRole: "admin",
      title: `KPI snapshot ${snapshot.at.slice(0, 10)}`,
      description: JSON.stringify(snapshot),
      createdAt: snapshot.at,
    },
  })

  return NextResponse.json({
    success: true,
    snapshot,
    note: "Raw StreamAnalytics are NOT mirrored. Internal docs / FAQ CMS remain optional and out of core migration.",
  })
}
