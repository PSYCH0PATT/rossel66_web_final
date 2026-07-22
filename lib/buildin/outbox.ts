import { prisma } from "@/lib/prisma"
import type { OutboxEventType } from "@/lib/buildin/types"
import type { Prisma } from "@prisma/client"

export async function enqueueBuildinOutbox(opts: {
  eventType: OutboxEventType
  payload: Record<string, unknown>
  submissionId?: string | null
  delayMs?: number
}) {
  const nextAttemptAt = new Date(Date.now() + (opts.delayMs ?? 0))
  return prisma.buildinOutbox.create({
    data: {
      eventType: opts.eventType,
      payload: opts.payload as Prisma.InputJsonValue,
      submissionId: opts.submissionId ?? null,
      status: "pending",
      nextAttemptAt,
    },
  })
}

function backoffMs(attempts: number): number {
  // 30s, 2m, 5m, 15m, 30m, 1h, 2h, 6h
  const table = [30, 120, 300, 900, 1800, 3600, 7200, 21600]
  const sec = table[Math.min(attempts, table.length - 1)] ?? 21600
  return sec * 1000
}

export async function claimPendingOutbox(limit = 10) {
  const now = new Date()
  const rows = await prisma.buildinOutbox.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: 8 },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })

  const claimed = []
  for (const row of rows) {
    const updated = await prisma.buildinOutbox.updateMany({
      where: { id: row.id, status: { in: ["pending", "failed"] } },
      data: { status: "processing", updatedAt: new Date() },
    })
    if (updated.count === 1) claimed.push(row)
  }
  return claimed
}

export async function markOutboxDone(id: string) {
  return prisma.buildinOutbox.update({
    where: { id },
    data: {
      status: "done",
      processedAt: new Date(),
      lastError: null,
    },
  })
}

export async function markOutboxFailed(id: string, error: string, attempts: number, maxAttempts: number) {
  const next = attempts + 1
  const dead = next >= maxAttempts
  return prisma.buildinOutbox.update({
    where: { id },
    data: {
      status: dead ? "dead" : "failed",
      attempts: next,
      lastError: error.slice(0, 4000),
      nextAttemptAt: new Date(Date.now() + backoffMs(next)),
      processedAt: dead ? new Date() : null,
    },
  })
}

export async function upsertExternalId(opts: {
  entityType: string
  localId: string
  buildinPageId: string
  buildinDbKey?: string | null
  submissionId?: string | null
  version?: number
}) {
  return prisma.buildinExternalId.upsert({
    where: {
      entityType_localId: {
        entityType: opts.entityType,
        localId: opts.localId,
      },
    },
    create: {
      entityType: opts.entityType,
      localId: opts.localId,
      buildinPageId: opts.buildinPageId,
      buildinDbKey: opts.buildinDbKey ?? null,
      submissionId: opts.submissionId ?? null,
      version: opts.version ?? 1,
      lastSyncedAt: new Date(),
    },
    update: {
      buildinPageId: opts.buildinPageId,
      buildinDbKey: opts.buildinDbKey ?? undefined,
      version: opts.version ?? undefined,
      lastSyncedAt: new Date(),
      submissionId: opts.submissionId ?? undefined,
    },
  })
}

export async function getExternalId(entityType: string, localId: string) {
  return prisma.buildinExternalId.findUnique({
    where: { entityType_localId: { entityType, localId } },
  })
}
