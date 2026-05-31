import { prisma } from "@/lib/prisma"

export type ParserCookiePlatform = "bandlink" | "vk"

export async function getParserCookiesRecord(
  platform: ParserCookiePlatform
): Promise<Record<string, string>> {
  const rows = await prisma.parserCookie.findMany({
    where: { platform },
    orderBy: { name: "asc" },
  })
  const out: Record<string, string> = {}
  for (const row of rows) {
    out[row.name] = row.value
  }
  return out
}

export async function listParserCookies(platform: ParserCookiePlatform) {
  const rows = await prisma.parserCookie.findMany({
    where: { platform },
    orderBy: { name: "asc" },
  })
  const lastUpdated =
    rows.length > 0
      ? rows.reduce(
          (max, r) => (r.updatedAt > max ? r.updatedAt : max),
          rows[0].updatedAt
        )
      : null

  return {
    cookies: rows.map((r) => ({ name: r.name, value: r.value })),
    count: rows.length,
    lastUpdated: lastUpdated?.toISOString() ?? null,
  }
}

export async function replaceParserCookies(
  platform: ParserCookiePlatform,
  cookies: { name: string; value: string }[]
): Promise<number> {
  await prisma.$transaction(async (tx) => {
    await tx.parserCookie.deleteMany({ where: { platform } })
    if (cookies.length > 0) {
      await tx.parserCookie.createMany({
        data: cookies.map((c) => ({ platform, name: c.name, value: c.value })),
      })
    }
  })
  return cookies.length
}

export async function deleteParserCookies(platform: ParserCookiePlatform): Promise<void> {
  await prisma.parserCookie.deleteMany({ where: { platform } })
}
