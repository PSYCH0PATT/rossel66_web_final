import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

/**
 * Postgres-backed rate limit for multi-instance deployments.
 */
export async function rateLimitFormAction(
  key: string,
  max: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const now = Date.now()
  const existing = await prisma.formRateBucket.findUnique({ where: { key } })
  if (!existing || existing.resetAt.getTime() <= now) {
    await prisma.formRateBucket.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        resetAt: new Date(now + windowMs),
      },
      update: {
        count: 1,
        resetAt: new Date(now + windowMs),
      },
    })
    return { ok: true }
  }
  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((existing.resetAt.getTime() - now) / 1000),
    }
  }
  await prisma.formRateBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  })
  return { ok: true }
}

export async function assertOutboxBackpressure(): Promise<NextResponse | null> {
  const pending = await prisma.buildinOutbox.count({
    where: { status: { in: ["pending", "processing", "failed"] } },
  })
  const limit = Number(process.env.FORM_OUTBOX_BACKPRESSURE_LIMIT || 500)
  if (pending > limit) {
    return NextResponse.json(
      {
        message:
          "Сервис временно перегружен очередью доставки. Повторите через минуту.",
        code: "outbox_backpressure",
      },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    )
  }
  return null
}

export function rateLimitResponse(retryAfterSec?: number) {
  return NextResponse.json(
    {
      message: "Слишком много запросов. Подождите и попробуйте снова.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: retryAfterSec
        ? { "Retry-After": String(retryAfterSec) }
        : undefined,
    }
  )
}
