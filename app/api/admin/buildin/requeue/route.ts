import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { requeueDeadOutbox } from "@/lib/buildin/outbox"

export const dynamic = "force-dynamic"

/** Admin: requeue dead Buildin outbox jobs (all or by ids). */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  let ids: string[] | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (Array.isArray(body?.ids)) {
      ids = body.ids.map(String).filter(Boolean)
    }
  } catch {
    ids = undefined
  }

  const requeued = await requeueDeadOutbox(ids?.length ? ids : undefined)
  return NextResponse.json({ success: true, requeued })
}
