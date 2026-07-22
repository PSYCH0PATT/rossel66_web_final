import { prisma } from './lib/prisma'
async function main() {
  const r = await prisma.release.findFirst({ where: { id: "1771261514409" } })
  console.log("TRACKS:", JSON.stringify(r?.tracks, null, 2))
  process.exit(0)
}
main()
