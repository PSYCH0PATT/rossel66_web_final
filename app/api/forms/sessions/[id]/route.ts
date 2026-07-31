import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import {
  FormSessionError,
  getFormSessionStatus,
  materializeFormSession,
} from "@/lib/buildin/form-session"
import { enqueueBuildinOutbox } from "@/lib/buildin/outbox"

type Ctx = { params: Promise<{ id: string }> }

function bearerOrBodyToken(req: NextRequest, body?: { accessToken?: string }) {
  const h = req.headers.get("authorization") || ""
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim()
  return body?.accessToken?.trim() || ""
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl
  try {
    const { id } = await ctx.params
    const token =
      bearerOrBodyToken(request) ||
      request.nextUrl.searchParams.get("accessToken") ||
      ""
    const status = await getFormSessionStatus({
      sessionId: id,
      accessToken: token,
    })
    return NextResponse.json(status)
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

/** Trigger / continue materialize (also done by outbox). */
export async function POST(request: NextRequest, ctx: Ctx) {
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl
  try {
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const token = bearerOrBodyToken(request, body)
    await getFormSessionStatus({ sessionId: id, accessToken: token })
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
