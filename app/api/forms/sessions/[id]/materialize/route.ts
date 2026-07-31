import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  FormSessionError,
  getFormSessionStatus,
  materializeFormSession,
} from "@/lib/buildin/form-session"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Ctx) {
  const originBlock = assertFormRequestOrigin(request)
  if (originBlock) return originBlock
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl
  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const accessToken = String(body.accessToken || "").trim()
    await getFormSessionStatus({ sessionId: id, accessToken })
    const result = await materializeFormSession(id)
    if (result.remaining > 0) {
      await enqueueBuildinOutbox({
        eventType: "form_session_materialize",
        entityKey: id,
        payload: { sessionId: id },
        delayMs: 1000,
      })
    }
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof FormSessionError) {
      return NextResponse.json(
        { message: err.message, code: err.code },
        { status: err.httpStatus }
      )
    }
    return NextResponse.json({ message: "Ошибка" }, { status: 500 })
  }
}
