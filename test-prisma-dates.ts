import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const allMatches = await prisma.release.findMany({
    select: { id: true, releaseDate: true, createdAt: true, title: true, artistId: true },
  })

  console.log("Raw from DB (first 5):", allMatches.slice(0, 5).map(m => m.releaseDate))

  const parseDate = (dStr) => {
    if (!dStr || dStr === "--") return 0
    const parts = dStr.split(".")
    if (parts.length === 3) {
      const [d, m, y] = parts
      return new Date(`${y}-${m}-${d}`).getTime()
    }
    return 0
  }

  allMatches.sort((a, b) => {
    const timeA = parseDate(a.releaseDate)
    const timeB = parseDate(b.releaseDate)
    if (timeA !== timeB) {
      return timeB - timeA // Descending: newest first
    }
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  console.log("Sorted titles and dates:")
  for (let i = 0; i < 15; i++) {
    if (allMatches[i]) console.log(allMatches[i].title, "|", allMatches[i].releaseDate)
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
