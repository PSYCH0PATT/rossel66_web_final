import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  finalizeFormSession,
  FormSessionError,
} from "@/lib/buildin/form-session"
import {
  rateLimitFormAction,
  rateLimitResponse,
} from "@/lib/buildin/form-rate-limit"

type Ctx = { params: Promise<{ id: string }> }

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const originBlock = assertFormRequestOrigin(request)
  if (originBlock) return originBlock
  const ipRl = await rateLimitFormAction(
    `finalize:${clientIp(request)}`,
    20,
    60_000
  )
  if (!ipRl.ok) return rateLimitResponse(ipRl.retryAfterSec)
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const result = await finalizeFormSession({
      sessionId: id,
      accessToken: String(body.accessToken || "").trim(),
    })
    return NextResponse.json(result, { status: 202 })
  } catch (err) {
    if (err instanceof FormSessionError) {
      return NextResponse.json(
        { message: err.message, code: err.code },
        { status: err.httpStatus }
      )
    }
    const message = err instanceof Error ? err.message : "Ошибка"
    return NextResponse.json({ message }, { status: 500 })
  }
}
