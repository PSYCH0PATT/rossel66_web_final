import { prisma } from './lib/prisma'
async function main() {
  const r = await prisma.release.findFirst({ where: { title: { contains: 'Silly Player' } } })
  console.log("ID:", r?.id)
  process.exit(0)
}
main()
