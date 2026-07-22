import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { prisma } from "@/lib/prisma"
import { isPyrusWriteDisabled, isBuildinDualWriteEnabled } from "@/lib/buildin/env"

export const dynamic = "force-dynamic"

/** Admin reconciliation dashboard for form dual-write / cutover readiness. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const [total, completed, partial, failed, pending, withPyrus, withBuildin, both, neither, byType, recentIssues, outboxPending, outboxDead] =
    await Promise.all([
      prisma.formSubmission.count(),
      prisma.formSubmission.count({ where: { status: "completed" } }),
      prisma.formSubmission.count({ where: { status: "partial" } }),
      prisma.formSubmission.count({ where: { status: "failed" } }),
      prisma.formSubmission.count({ where: { status: { in: ["pending", "dual_writing"] } } }),
      prisma.formSubmission.count({ where: { pyrusTaskId: { not: null } } }),
      prisma.formSubmission.count({ where: { buildinPageId: { not: null } } }),
      prisma.formSubmission.count({
        where: { AND: [{ pyrusTaskId: { not: null } }, { buildinPageId: { not: null } }] },
      }),
      prisma.formSubmission.count({
        where: { AND: [{ pyrusTaskId: null }, { buildinPageId: null }] },
      }),
      prisma.formSubmission.groupBy({ by: ["formType"], _count: { _all: true } }),
      prisma.formSubmission.findMany({
        where: {
          OR: [{ status: { in: ["partial", "failed"] } }, { lastError: { not: null } }],
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
      prisma.buildinOutbox.count({
        where: { status: { in: ["pending", "failed", "processing"] } },
      }),
      prisma.buildinOutbox.count({ where: { status: "dead" } }),
    ])

  const cutoverReady =
    neither === 0 &&
    failed === 0 &&
    partial === 0 &&
    outboxDead === 0 &&
    outboxPending === 0 &&
    total > 0

  return NextResponse.json({
    flags: {
      buildinDualWrite: isBuildinDualWriteEnabled(),
      pyrusWriteDisabled: isPyrusWriteDisabled(),
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
    outbox: { pendingOrFailed: outboxPending, dead: outboxDead },
    recentIssues,
    cutoverReady,
    cutoverChecklist: [
      "Все 5 форм: одиночный файл, несколько WAV, файл ~100МБ, retry, duplicate",
      "PII ACL: закрытые базы видны только уполномоченным",
      "Команда обработала реальные заявки в Buildin",
      "Rollback: PYRUS_WRITE_DISABLED=false восстановлен и проверен",
      "Экспорт ID map: npm run export:buildin-id-map",
    ],
  })
}
