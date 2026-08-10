/**
 * Controlled reverse sync stub: Buildin → Postgres version/audit marker only.
 *
 * Ops fields (Операционный статус, Ответственный, Заметки, Дедлайн, Теги) remain Buildin-owned.
 * This endpoint does NOT persist them into Postgres domain tables until a dedicated
 * ops store exists. Prefer export + reconciliation for backup of ops data.
 */
import { prisma } from "@/lib/prisma"
import {
  ARTIST_OPS_ALLOWLIST,
  RELEASE_OPS_ALLOWLIST,
} from "@/lib/buildin/adapters/artists-releases"
import { REPORT_OPS_ALLOWLIST } from "@/lib/buildin/adapters/ops-mirrors"
import { getExternalId, upsertExternalId } from "@/lib/buildin/outbox"
import type { Prisma } from "@prisma/client"

export type ReverseSyncEntity = "artist" | "release" | "report"

type ReverseResult =
  | { ok: true; applied: string[]; skipped: string[]; version: number }
  | { ok: false; error: string; status: number }

function pickAllowlisted(
  incoming: Record<string, unknown>,
  allowlist: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      out[key] = incoming[key]
    }
  }
  return out
}

/**
 * Apply allowlisted ops updates from Buildin webhook / admin pull.
 * Stores ops metadata in BuildinExternalId.version; does NOT mutate
 * financial fields, Release.status (auto), password, or roles.
 */
export async function applyBuildinOpsReverseSync(input: {
  entityType: ReverseSyncEntity
  localId: string
  buildinPageId: string
  incomingVersion: number
  fields: Record<string, unknown>
}): Promise<ReverseResult> {
  const mapping = await getExternalId(input.entityType, input.localId)
  const localVersion = mapping?.version ?? 0

  if (input.incomingVersion <= localVersion) {
    return {
      ok: false,
      error: `Stale version: incoming ${input.incomingVersion} <= local ${localVersion}`,
      status: 409,
    }
  }

  const allowlist =
    input.entityType === "artist"
      ? ARTIST_OPS_ALLOWLIST
      : input.entityType === "release"
        ? RELEASE_OPS_ALLOWLIST
        : REPORT_OPS_ALLOWLIST

  const appliedKeys = Object.keys(pickAllowlisted(input.fields, allowlist))
  const skipped = Object.keys(input.fields).filter((k) => !allowlist.includes(k as never))

  // Ops fields live in Buildin; Postgres only tracks sync version + mapping.
  // We intentionally do not write opsStatus/assignee into User/Release/Report
  // columns yet (those financial/auto columns stay Postgres-owned).
  await upsertExternalId({
    entityType: input.entityType,
    localId: input.localId,
    buildinPageId: input.buildinPageId,
    version: input.incomingVersion,
  })

  const auditPayload = {
    localId: input.localId,
    applied: appliedKeys,
    skipped,
    incomingVersion: input.incomingVersion,
    fields: pickAllowlisted(input.fields, allowlist),
  }

  // Audit trail via outbox done-marker style row (optional visibility)
  await prisma.buildinOutbox.create({
    data: {
      eventType: `reverse_${input.entityType}`,
      payload: auditPayload as Prisma.InputJsonValue,
      status: "done",
      processedAt: new Date(),
    },
  })

  return {
    ok: true,
    applied: appliedKeys,
    skipped,
    version: input.incomingVersion,
  }
}
