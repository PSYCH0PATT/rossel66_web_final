import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  rateLimitFormAction,
  rateLimitResponse,
} from "@/lib/buildin/form-rate-limit"
import {
  FormSessionError,
  presignFormSessionFile,
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
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl
  const ipRl = await rateLimitFormAction(
    `presign:${clientIp(request)}`,
    120,
    60_000
  )
  if (!ipRl.ok) return rateLimitResponse(ipRl.retryAfterSec)
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const accessToken = String(body.accessToken || "").trim()
    const fieldKey = String(body.fieldKey || "").trim()
    if (!accessToken || !fieldKey) {
      return NextResponse.json(
        { message: "Нужны accessToken и fieldKey" },
        { status: 400 }
      )
    }
    const result = await presignFormSessionFile({
      sessionId: id,
      accessToken,
      fieldKey,
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
