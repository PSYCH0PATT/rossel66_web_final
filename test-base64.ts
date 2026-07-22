import { prisma } from './lib/prisma'
async function main() {
  const rs = await prisma.release.findMany({ select: { id: true, coverUrl: true } })
  for (const r of rs) {
    if (r.coverUrl && r.coverUrl.length > 500) {
      console.log(`Release ${r.id} has large coverUrl: ${r.coverUrl.length} bytes`)
    }
  }
  process.exit(0)
}
main()
