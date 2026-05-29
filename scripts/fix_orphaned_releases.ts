import { prisma } from "../lib/prisma"

async function main() {
  console.log("Starting to fix orphaned releases...")

  // Find all releases
  const releases = await prisma.release.findMany()
  console.log(`Found ${releases.length} total releases.`)

  // Find all valid users
  const users = await prisma.user.findMany({ select: { id: true } })
  const validUserIds = new Set(users.map(u => u.id))

  let deletedCount = 0

  for (const release of releases) {
    if (release.artistId && !validUserIds.has(release.artistId)) {
      console.log(`Orphaned release found: "${release.title}" (ID: ${release.id}, ArtistID: ${release.artistId})`)
      
      // Delete the release
      await prisma.release.delete({
        where: { id: release.id }
      })
      console.log(`-> Deleted release ${release.id}`)
      deletedCount++
    }
  }

  console.log(`Finished. Deleted ${deletedCount} orphaned releases.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
