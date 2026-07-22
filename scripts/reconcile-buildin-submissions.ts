/**
 * Reconcile FormSubmission dual-write state (Pyrus vs Buildin).
 *   npx tsx scripts/reconcile-buildin-submissions.ts
 */
import { prisma } from "../lib/prisma"

async function main() {
  const [total, completed, partial, failed, pending, withPyrus, withBuildin, both, neither] =
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
    ])

  const byType = await prisma.formSubmission.groupBy({
    by: ["formType"],
    _count: { _all: true },
  })

  const recentIssues = await prisma.formSubmission.findMany({
    where: {
      OR: [
        { status: { in: ["partial", "failed"] } },
        { lastError: { not: null } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      formType: true,
      status: true,
      pyrusTaskId: true,
      buildinPageId: true,
      lastError: true,
      updatedAt: true,
      filesMeta: true,
    },
  })

  const outboxPending = await prisma.buildinOutbox.count({
    where: { status: { in: ["pending", "failed", "processing"] } },
  })
  const outboxDead = await prisma.buildinOutbox.count({ where: { status: "dead" } })

  const report = {
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
    cutoverReady:
      neither === 0 &&
      failed === 0 &&
      partial === 0 &&
      outboxDead === 0 &&
      outboxPending === 0 &&
      total > 0,
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.cutoverReady) {
    console.error("\nCutover NOT ready — fix partial/failed/outbox before PYRUS_WRITE_DISABLED=true")
    process.exitCode = 1
  } else {
    console.log("\nCutover criteria met for dual-write sample (also run E2E form checks).")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
