import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import {
  getBuildinDatabaseId,
  isPyrusWriteDisabled,
  isBuildinDualWriteEnabled,
  getBuildinApiToken,
} from "@/lib/buildin/env"
import { buildinQueryDatabase } from "@/lib/buildin/client"

export const dynamic = "force-dynamic"

async function mirrorStats(entityType: string, postgresCount: number) {
  const mapped = await prisma.buildinExternalId.count({ where: { entityType } })
  return {
    postgres: postgresCount,
    mapped,
    missingMapping: Math.max(0, postgresCount - mapped),
  }
}

/** Admin reconciliation for form dual-write + active entity mirrors / cutover readiness. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const [
    total,
    completed,
    partial,
    failed,
    pending,
    withPyrus,
    withBuildin,
    both,
    neither,
    byType,
    recentIssues,
    outboxPending,
    outboxFailed,
    outboxProcessing,
    outboxDead,
    artistsPg,
    releasesPg,
    tracksMapped,
    reportsPg,
    playlistsPg,
  ] = await Promise.all([
    prisma.formSubmission.count(),
    prisma.formSubmission.count({ where: { status: "completed" } }),
    prisma.formSubmission.count({ where: { status: "partial" } }),
    prisma.formSubmission.count({ where: { status: "failed" } }),
    prisma.formSubmission.count({
      where: { status: { in: ["pending", "dual_writing"] } },
    }),
    prisma.formSubmission.count({ where: { pyrusTaskId: { not: null } } }),
    prisma.formSubmission.count({ where: { buildinPageId: { not: null } } }),
    prisma.formSubmission.count({
      where: {
        AND: [{ pyrusTaskId: { not: null } }, { buildinPageId: { not: null } }],
      },
    }),
    prisma.formSubmission.count({
      where: { AND: [{ pyrusTaskId: null }, { buildinPageId: null }] },
    }),
    prisma.formSubmission.groupBy({ by: ["formType"], _count: { _all: true } }),
    prisma.formSubmission.findMany({
      where: {
        OR: [
          { status: { in: ["partial", "failed"] } },
          { lastError: { not: null } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        formType: true,
        title: true,
        status: true,
        pyrusTaskId: true,
        buildinPageId: true,
        lastError: true,
        filesMeta: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.buildinOutbox.count({ where: { status: "pending" } }),
    prisma.buildinOutbox.count({ where: { status: "failed" } }),
    prisma.buildinOutbox.count({ where: { status: "processing" } }),
    prisma.buildinOutbox.count({ where: { status: "dead" } }),
    prisma.user.count({ where: { role: "artist" } }),
    prisma.release.count(),
    prisma.buildinExternalId.count({ where: { entityType: "track" } }),
    prisma.report.count(),
    prisma.playlistTrackPlacement.count({ where: { isActive: true } }),
  ])

  const mirrors = {
    artist: await mirrorStats("artist", artistsPg),
    release: await mirrorStats("release", releasesPg),
    track: { mapped: tracksMapped },
    report: await mirrorStats("report", reportsPg),
    playlist_placement: await mirrorStats("playlist_placement", playlistsPg),
    /** @deprecated legacy 1:1 playlist-row mappings */
    playlist_legacy: await mirrorStats(
      "playlist",
      await prisma.playlist.count()
    ),
    submission: await mirrorStats("submission", total),
  }

  let buildinQueryOk: Record<string, boolean | string> = {}
  if (getBuildinApiToken()) {
    const sampleKeys = [
      "submissions",
      "artists",
      "releases",
      "reports",
      "playlists",
    ] as const
    for (const key of sampleKeys) {
      const dbId = getBuildinDatabaseId(key)
      if (!dbId) {
        buildinQueryOk[key] = "missing_db_id"
        continue
      }
      try {
        await buildinQueryDatabase(dbId, { page_size: 1 })
        buildinQueryOk[key] = true
      } catch (err) {
        buildinQueryOk[key] =
          err instanceof Error ? err.message.slice(0, 120) : "query_failed"
      }
    }
  }

  const allQueriesOk = Object.values(buildinQueryOk).every((v) => v === true)
  const mirrorGaps =
    mirrors.artist.missingMapping +
    mirrors.release.missingMapping +
    mirrors.report.missingMapping +
    mirrors.playlist_placement.missingMapping

  const cutoverReady =
    neither === 0 &&
    failed === 0 &&
    partial === 0 &&
    outboxDead === 0 &&
    outboxPending === 0 &&
    outboxFailed === 0 &&
    outboxProcessing === 0 &&
    total > 0 &&
    mirrorGaps === 0 &&
    allQueriesOk
  // Keep PYRUS_WRITE_DISABLED=false until cutoverReady + ACL checklist are green.

  return NextResponse.json({
    flags: {
      buildinDualWrite: isBuildinDualWriteEnabled(),
      pyrusWriteDisabled: isPyrusWriteDisabled(),
      note: "Keep PYRUS_WRITE_DISABLED=false until security, retry, ACL and reconciliation are green.",
    },
    submissions: {
      total,
      completed,
      partial,
      failed,
      pending,
      withPyrus,
      withBuildin,
      both,
      neither,
      byType,
    },
    outbox: {
      pending: outboxPending,
      failed: outboxFailed,
      processing: outboxProcessing,
      dead: outboxDead,
    },
    mirrors,
    buildinQueryOk,
    recentIssues,
    cutoverReady,
    cutoverChecklist: [
      "Все 5 форм: одиночный файл, несколько WAV, файл ~100МБ, retry, duplicate",
      "PII ACL: закрытые базы видны только уполномоченным (legal vs ops)",
      "Partial PATCH: ручной Ops Status не сбрасывается forward-sync",
      "File staging retry: incomplete uploads stay partial until files complete",
      "Команда обработала реальные заявки в Buildin Inbox",
      "Reconciliation: npm run reconcile:buildin-mirrors",
      "Rollback: PYRUS_WRITE_DISABLED=false восстановлен и проверен",
      "Экспорт ID map: npm run export:buildin-id-map",
    ],
  })
}
