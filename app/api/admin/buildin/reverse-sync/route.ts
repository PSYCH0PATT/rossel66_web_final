import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { applyBuildinOpsReverseSync } from "@/lib/buildin/reverse-sync"
import { z } from "zod"

const bodySchema = z.object({
  entityType: z.enum(["artist", "release", "report"]),
  localId: z.string().min(1),
  buildinPageId: z.string().min(1),
  incomingVersion: z.number().int().positive(),
  fields: z.record(z.string(), z.unknown()),
})

/**
 * Apply allowlisted ops fields from Buildin → local mapping/version store.
 * Does not mutate financial flags or Release.auto status.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const result = await applyBuildinOpsReverseSync(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true, ...result })
}
