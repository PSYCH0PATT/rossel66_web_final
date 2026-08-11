import { prisma } from '../../lib/prisma'

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: '0xr' }
  })

  console.dir(user)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
