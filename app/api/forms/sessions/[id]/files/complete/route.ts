import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  rateLimitFormAction,
  rateLimitResponse,
} from "@/lib/buildin/form-rate-limit"
import {
  completeFormSessionFile,
  FormSessionError,
} from "@/lib/buildin/form-session"

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
    `complete:${clientIp(request)}`,
    120,
    60_000
  )
  if (!ipRl.ok) return rateLimitResponse(ipRl.retryAfterSec)
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const result = await completeFormSessionFile({
      sessionId: id,
      accessToken: String(body.accessToken || "").trim(),
      fieldKey: String(body.fieldKey || "").trim(),
      ossName: String(body.ossName || body.oss_name || "").trim(),
      sizeBytes:
        typeof body.sizeBytes === "number" ? body.sizeBytes : undefined,
    })
    return NextResponse.json(result)
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
