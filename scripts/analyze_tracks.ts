import { prisma } from '../lib/prisma'

async function main() {
  const allReleases = await prisma.release.findMany()
  
  let validTracks = 0
  let emptyTracks = 0
  let noDuration = 0

  for (const r of allReleases) {
    const tracks = typeof r.tracks === 'string' ? JSON.parse(r.tracks) : r.tracks;
    if (Array.isArray(tracks) && tracks.length > 0) {
      validTracks++;
      for (const t of tracks) {
        if (!t.duration || t.duration === '') {
          noDuration++;
        }
      }
    } else {
      emptyTracks++;
    }
  }

  console.log(`Releases with tracks: ${validTracks}`)
  console.log(`Releases with empty tracks array: ${emptyTracks}`)
  console.log(`Total tracks with no duration: ${noDuration}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
