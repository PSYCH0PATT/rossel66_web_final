import { prisma } from '../../lib/prisma'

async function main() {
  const allReleases = await prisma.release.findMany({
    where: {
      title: {
        contains: 'ohla',
        mode: 'insensitive'
      }
    }
  })

  console.log(`Releases found with 'ohla': ${allReleases.length}`)
  console.dir(allReleases, { depth: null })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
