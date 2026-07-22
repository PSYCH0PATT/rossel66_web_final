import { prisma } from './lib/prisma'
import { releaseFromPrisma } from './lib/storage-adapters'
async function main() {
  const r = await prisma.release.findFirst({ where: { title: { contains: 'Silly Player' } } })
  if (r) {
    const parsed = releaseFromPrisma(r)
    console.log("PARSED TRACKS:", JSON.stringify(parsed.tracks, null, 2))
  }
  process.exit(0)
}
main()
