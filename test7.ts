import { prisma } from './lib/prisma'
async function main() {
  const rs = await prisma.release.findMany({ where: { title: { contains: 'Silly Player', mode: 'insensitive' } } })
  for (const r of rs) {
    console.log(`ID: ${r.id}, Created: ${r.createdAt}, Updated: ${r.updatedAt}, Tracks: ${(r.tracks as any[])?.length || 0}`)
  }
  process.exit(0)
}
main()
