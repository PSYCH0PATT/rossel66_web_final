import { prisma } from "@/lib/prisma"
import type { OutboxEventType } from "@/lib/buildin/types"
import type { Prisma } from "@prisma/client"

const STALE_PROCESSING_MS = 15 * 60 * 1000

function payloadEntityId(
  eventType: OutboxEventType,
  payload: Record<string, unknown>
): string | null {
  if (payload.id != null) return String(payload.id)
  if (eventType === "sync_parser" && payload.platform != null) {
    return String(payload.platform)
  }
  if (payload.submissionId != null) return String(payload.submissionId)
  if (payload.sessionId != null) return String(payload.sessionId)
  return null
}

/**
 * Enqueue with coalescing: if a pending/failed job for the same entity exists,
 * refresh its payload instead of creating a duplicate.
 */
export async function enqueueBuildinOutbox(opts: {
  eventType: OutboxEventType
  payload: Record<string, unknown>
  submissionId?: string | null
  delayMs?: number
  entityKey?: string
}) {
  const nextAttemptAt = new Date(Date.now() + (opts.delayMs ?? 0))
  const entityId = opts.entityKey ?? payloadEntityId(opts.eventType, opts.payload)

  if (entityId || opts.submissionId) {
    const candidates = await prisma.buildinOutbox.findMany({
      where: {
        eventType: opts.eventType,
        status: { in: ["pending", "failed"] },
        ...(opts.submissionId ? { submissionId: opts.submissionId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    })

    const match = candidates.find((row) => {
      if (opts.submissionId && row.submissionId === opts.submissionId) return true
      const p = row.payload as Record<string, unknown>
      const rowId = payloadEntityId(opts.eventType, p)
      return entityId != null && rowId === entityId
    })

    if (match) {
      return prisma.buildinOutbox.update({
        where: { id: match.id },
        data: {
          payload: opts.payload as Prisma.InputJsonValue,
          status: "pending",
          nextAttemptAt,
          lastError: null,
          submissionId: opts.submissionId ?? match.submissionId,
        },
      })
    }
  }

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
  const table = [30, 120, 300, 900, 1800, 3600, 7200, 21600]
  const sec = table[Math.min(attempts, table.length - 1)] ?? 21600
  const jitter = Math.floor(Math.random() * Math.min(sec * 0.2, 60))
  return (sec + jitter) * 1000
}

/** Reclaim jobs stuck in `processing` longer than the lease TTL. */
export async function reclaimStaleProcessing(
  olderThanMs = STALE_PROCESSING_MS
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs)
  const result = await prisma.buildinOutbox.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "failed",
      nextAttemptAt: new Date(),
      lastError: "Reclaimed stale processing lease",
    },
  })
  return result.count
}

export async function claimPendingOutbox(limit = 10) {
  await reclaimStaleProcessing()

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

export async function markOutboxFailed(
  id: string,
  error: string,
  attempts: number,
  maxAttempts: number
) {
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

export async function requeueDeadOutbox(ids?: string[]) {
  const where: Prisma.BuildinOutboxWhereInput = {
    status: "dead",
    ...(ids?.length ? { id: { in: ids } } : {}),
  }
  const result = await prisma.buildinOutbox.updateMany({
    where,
    data: {
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      processedAt: null,
    },
  })
  return result.count
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
