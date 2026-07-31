import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"
import { getBuildinDatabaseId } from "@/lib/buildin/env"

export const dynamic = "force-dynamic"

/**
 * Optional: publish a periodic KPI snapshot into Buildin automation_runs (tech)
 * instead of the archived Activity mirror. Aggregates only — never raw StreamAnalytics.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  if (!getBuildinDatabaseId("automation_runs")) {
    return NextResponse.json(
      { error: "BUILDIN_DB_AUTOMATION_RUNS not configured; KPI snapshots skipped" },
      { status: 503 }
    )
  }

  const [artists, releases, reportsUnpaid, playlists, submissionsOpen, outboxDead] =
    await Promise.all([
      prisma.user.count({ where: { role: "artist" } }),
      prisma.release.count(),
      prisma.report.count({ where: { isPaid: false } }),
      prisma.playlist.count(),
      prisma.formSubmission.count({
        where: { status: { in: ["pending", "partial", "dual_writing"] } },
      }),
      prisma.buildinOutbox.count({ where: { status: "dead" } }),
    ])

  const snapshot = {
    at: new Date().toISOString(),
    artists,
    releases,
    reportsUnpaid,
    playlists,
    submissionsOpen,
    outboxDead,
  }

  await enqueueBuildinOutbox({
    eventType: "sync_parser",
    entityKey: "kpi_snapshot",
    payload: {
      platform: "kpi_snapshot",
      status: outboxDead > 0 ? "error" : "ok",
      lastRun: snapshot.at,
      needsNewCookies: false,
      failedAttempts: outboxDead,
      lastError: JSON.stringify(snapshot).slice(0, 500),
      adminLink: "/dashboard/admin",
    },
  })

  return NextResponse.json({
    success: true,
    snapshot,
    note: "Activity/PlaylistHistory mirrors are archived. KPI goes to automation_runs.",
  })
}
