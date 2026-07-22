import { prisma } from '../lib/prisma'

async function main() {
  const allReleases = await prisma.release.findMany()
  
  let stringTracks = 0
  let objectTracks = 0

  for (const r of allReleases) {
    if (typeof r.tracks === 'string') {
      stringTracks++;
    } else {
      objectTracks++;
    }
  }

  console.log(`Releases with tracks as string: ${stringTracks}`)
  console.log(`Releases with tracks as object: ${objectTracks}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
