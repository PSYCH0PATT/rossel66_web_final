import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

/**
 * Сбрасывает ISR + unstable_cache для дашборда артиста после изменения релизов.
 */
export async function revalidateArtistDashboardsForArtistIds(
  ids: (string | null | undefined)[]
): Promise<void> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])]
  if (uniq.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: uniq }, role: "artist" },
      select: { username: true },
    })
    for (const { username } of users) {
      revalidatePath(`/dashboard/artist/${username}/dashboard`)
    }
  } catch {
    /* вне контекста Next (скрипты) — тихо */
  }
}
