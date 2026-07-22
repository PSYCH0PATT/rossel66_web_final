import { prisma } from '../lib/prisma'

async function main() {
  const ohla = await prisma.release.findUnique({ where: { id: '1779095009702' } })
  console.log("Release OHLA:", ohla)
  
  const tracks = typeof ohla?.tracks === 'string' ? JSON.parse(ohla.tracks) : ohla?.tracks
  console.log("Parsed tracks:", tracks)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
