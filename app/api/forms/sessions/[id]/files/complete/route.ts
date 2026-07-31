import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { guardPublicFormRateLimit } from "@/lib/pyrus-public-schemas"
import { assertFormRequestOrigin } from "@/lib/buildin/form-origin"
import {
  completeFormSessionFile,
  FormSessionError,
} from "@/lib/buildin/form-session"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Ctx) {
  const originBlock = assertFormRequestOrigin(request)
  if (originBlock) return originBlock
  const rl = guardPublicFormRateLimit(request)
  if (rl) return rl
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
