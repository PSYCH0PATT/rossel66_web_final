import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  assertOutboxBackpressure,
  rateLimitFormAction,
  rateLimitResponse,
} from "@/lib/buildin/form-rate-limit"
import { createSimpleBuildinSubmission } from "@/lib/buildin/form-session"
import { isBuildinDualWriteEnabled } from "@/lib/buildin/env"

export const maxDuration = 60

const bodySchema = z.object({
  formType: z.enum(["contact", "data_rf", "data_not_rf"]),
  title: z.string().min(1).max(500),
  contactEmail: z.string().email().optional().nullable(),
  contactTelegram: z.string().max(200).optional().nullable(),
  artistNickname: z.string().max(200).optional().nullable(),
  payload: z.record(z.string(), z.unknown()).default({}),
  uploadId: z.string().min(8).max(120).optional(),
})

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
  const ipRl = await rateLimitFormAction(`simple:${ip}`, 10, 60_000)
  if (!ipRl.ok) return rateLimitResponse(ipRl.retryAfterSec)

  try {
    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        {
          message: parsed.error.issues.map((i) => i.message).join("; "),
        },
        { status: 400 }
      )
    }
    const data = parsed.data

    // Never echo PII back; store only via dual-write + closed PII DBs
    const dual = await createSimpleBuildinSubmission({
      formType: data.formType,
      title: data.title,
      contactEmail: data.contactEmail,
      contactTelegram: data.contactTelegram,
      artistNickname: data.artistNickname,
      payload: data.payload,
      idempotencySeed:
        data.uploadId ||
        `${data.formType}:${data.contactTelegram || ""}:${data.title}`,
    })

    return NextResponse.json(
      {
        ok: true,
        submissionId: dual.submissionId,
        buildinPageId: dual.buildinPageId,
        status: dual.status,
        warnings: dual.warnings,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка сервера"
    return NextResponse.json({ message }, { status: 500 })
  }
}
