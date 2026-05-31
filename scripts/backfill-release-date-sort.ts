/**
 * Backfill Release.releaseDateSort from releaseDate (DD.MM.YYYY or YYYY-MM-DD).
 * Run: npx tsx scripts/backfill-release-date-sort.ts
 */
import { prisma } from "../lib/prisma"
import { releaseDateToSortDate } from "../lib/release-date-sort"

async function main() {
  const rows = await prisma.release.findMany({
    select: { id: true, releaseDate: true, releaseDateSort: true },
  })
  let updated = 0
  for (const row of rows) {
    const next = releaseDateToSortDate(row.releaseDate)
    if (!next) continue
    if (row.releaseDateSort?.getTime() === next.getTime()) continue
    await prisma.release.update({
      where: { id: row.id },
      data: { releaseDateSort: next },
    })
    updated++
  }
  console.log(`Backfilled releaseDateSort for ${updated} / ${rows.length} releases`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
