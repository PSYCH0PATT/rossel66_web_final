import { prisma } from '../lib/prisma'

async function main() {
  const allReleases = await prisma.release.findMany()
  const allUsers = await prisma.user.findMany({ where: { role: 'artist' } })
  const userMap = new Map(allUsers.map(u => [u.id, u.name]))

  let missingArtist = 0
  let missingTracks = 0
  let total = allReleases.length

  const orphanReleases = []
  const noTrackReleases = []

  for (const r of allReleases) {
    if (!r.artistId || !userMap.has(r.artistId)) {
      missingArtist++
      orphanReleases.push({ id: r.id, title: r.title, artistId: r.artistId })
    }
    const tracks = typeof r.tracks === 'string' ? JSON.parse(r.tracks) : r.tracks;
    if (!tracks || (Array.isArray(tracks) && tracks.length === 0)) {
      missingTracks++
      noTrackReleases.push({ id: r.id, title: r.title, artist: r.artistId ? userMap.get(r.artistId) : 'N/A' })
    }
  }

  console.log(`Total releases: ${total}`)
  console.log(`Missing/Invalid artist (orphaned): ${missingArtist}`)
  console.log(`Missing tracks: ${missingTracks}`)
  
  if (missingArtist > 0) {
    console.log('\nSample orphaned releases (up to 5):')
    console.log(orphanReleases.slice(0, 5))
  }
  
  if (missingTracks > 0) {
    console.log('\nSample releases with no tracks (up to 5):')
    console.log(noTrackReleases.slice(0, 5))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
