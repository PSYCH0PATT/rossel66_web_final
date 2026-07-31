import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  assertOutboxBackpressure,
  rateLimitFormAction,
  rateLimitResponse,
} from "@/lib/buildin/form-rate-limit"
import {
  createFormDeliverySession,
  FormSessionError,
} from "@/lib/buildin/form-session"
import { isBuildinDualWriteEnabled } from "@/lib/buildin/env"

export const maxDuration = 60

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(request: NextRequest) {
  const originBlock = assertFormRequestOrigin(request)
  if (originBlock) return originBlock
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl

  if (!isBuildinDualWriteEnabled()) {
    return NextResponse.json(
      { message: "Buildin не настроен для приёма форм." },
      { status: 503 }
    )
  }

  const bp = await assertOutboxBackpressure()
  if (bp) return bp

  const ip = clientIp(request)
  const createRl = await rateLimitFormAction(`session-create:${ip}`, 8, 60_000)
  if (!createRl.ok) return rateLimitResponse(createRl.retryAfterSec)

  try {
    const body = await request.json()
    const uploadId = String(body.uploadId || body.upload_id || "").trim()
    if (!uploadId) {
      return NextResponse.json({ message: "Нужен uploadId" }, { status: 400 })
    }
    const created = await createFormDeliverySession({
      idempotencySeed: uploadId,
      manifest: body.manifest,
      clientIp: ip,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof FormSessionError) {
      return NextResponse.json(
        { message: err.message, code: err.code },
        { status: err.httpStatus }
      )
    }
    const message = err instanceof Error ? err.message : "Ошибка сервера"
    return NextResponse.json({ message }, { status: 500 })
  }
}
