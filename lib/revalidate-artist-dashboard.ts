import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import {
  CACHE_TAG_ADMIN_DASHBOARD,
  CACHE_TAG_ARTIST_DASHBOARD,
} from "@/lib/dashboard-cache-tags"

/**
 * Сбрасывает ISR + unstable_cache для дашборда артиста после изменения релизов.
 */
export async function revalidateArtistDashboardsForArtistIds(
  ids: (string | null | undefined)[]
): Promise<void> {
  const uniq = [...new Set(ids.filter(Boolean) as string[])]
  if (uniq.length === 0) return

  try {
    revalidateTag(CACHE_TAG_ARTIST_DASHBOARD)
    revalidateTag(CACHE_TAG_ADMIN_DASHBOARD)
    const users = await prisma.user.findMany({
      where: { id: { in: uniq }, role: "artist" },
      select: { username: true },
    })
    for (const { username } of users) {
      revalidatePath(`/dashboard/artist/${username}/dashboard`)
      revalidatePath(`/dashboard/artist/${username}/releases`)
    }
  } catch {
    /* вне контекста Next (скрипты) — тихо */
  }
}
