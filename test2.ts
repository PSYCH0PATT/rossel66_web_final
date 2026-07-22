import { prisma } from './lib/prisma'
async function main() {
  const r = await prisma.release.findFirst({ where: { title: { contains: 'Silly Player' } } })
  console.log("METADATA:", JSON.stringify(r?.metadata, null, 2))
  process.exit(0)
}
main()
