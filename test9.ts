import { prisma } from './lib/prisma'
async function main() {
  const rs = await prisma.release.findMany({ where: { koalaId: "6ska2m1ku" } })
  console.log(rs.length)
  process.exit(0)
}
main()
