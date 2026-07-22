import { prisma } from "@/lib/prisma"

export type ParserStatusPlatform = "bandlink" | "vk"

const DEFAULTS = {
  status: "idle",
  needsNewCookies: false,
  failedAttempts: 0,
} as const

export async function getParserRunStatus(platform: ParserStatusPlatform) {
  const row = await prisma.parserRunStatus.findUnique({ where: { platform } })
  if (!row) {
    return {
      platform,
      ...DEFAULTS,
      lastRun: null as Date | null,
      lastError: null as string | null,
    }
  }
  return row
}

export async function upsertParserRunStatus(
  platform: ParserStatusPlatform,
  data: {
    status?: string
    lastRun?: Date | null
    needsNewCookies?: boolean
    failedAttempts?: number
    lastError?: string | null
  }
) {
  const row = await prisma.parserRunStatus.upsert({
    where: { platform },
    create: {
      platform,
      status: data.status ?? DEFAULTS.status,
      lastRun: data.lastRun ?? null,
      needsNewCookies: data.needsNewCookies ?? DEFAULTS.needsNewCookies,
      failedAttempts: data.failedAttempts ?? DEFAULTS.failedAttempts,
      lastError: data.lastError ?? null,
    },
    update: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.lastRun !== undefined ? { lastRun: data.lastRun } : {}),
      ...(data.needsNewCookies !== undefined ? { needsNewCookies: data.needsNewCookies } : {}),
      ...(data.failedAttempts !== undefined ? { failedAttempts: data.failedAttempts } : {}),
      ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
    },
  })

  try {
    const { enqueueParserRunSync } = await import("@/lib/buildin/sync-hooks")
    await enqueueParserRunSync({
      platform: row.platform,
      status: row.status,
      lastRun: row.lastRun,
      needsNewCookies: row.needsNewCookies,
      failedAttempts: row.failedAttempts,
      lastError: row.lastError,
    })
  } catch (err) {
    console.error("Buildin parser sync enqueue failed:", err)
  }

  return row
}

export async function resetParserCookieAlert(platform: ParserStatusPlatform) {
  await upsertParserRunStatus(platform, {
    needsNewCookies: false,
    failedAttempts: 0,
    lastError: null,
  })
}
