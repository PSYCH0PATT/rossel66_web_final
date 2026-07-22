import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron-auth"
import { processBuildinOutbox } from "@/lib/buildin/process-outbox"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Process pending Buildin outbox jobs (dual-write retries + CRM mirrors). */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limitParam = request.nextUrl.searchParams.get("limit")
  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100)

  try {
    const result = await processBuildinOutbox(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Buildin outbox cron failed:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
