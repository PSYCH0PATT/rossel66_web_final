import { prisma } from '../lib/prisma';

async function main() {
  console.log('🚀 Starting migration script: Fixing dates and clearing fake ISRCs...');
  
  try {
    const releases = await prisma.release.findMany();
    console.log(`📊 Found ${releases.length} total releases in the database.`);
    
    let dateFixCount = 0;
    let isrcFixCount = 0;
    let totalUpdated = 0;
    
    for (const release of releases) {
      let needsUpdate = false;
      const dataToUpdate: any = {};
      
      // 1. Fix releaseDate format (DD.MM.YYYY -> YYYY-MM-DD)
      let currentReleaseDate = release.releaseDate || '';
      if (currentReleaseDate.includes('.')) {
        const parts = currentReleaseDate.split('.');
        if (parts.length === 3) {
          const newDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          console.log(`📅 Formatting date for release "${release.title}" (ID: ${release.id}): "${currentReleaseDate}" -> "${newDate}"`);
          dataToUpdate.releaseDate = newDate;
          needsUpdate = true;
          dateFixCount++;
        }
      }
      
      // 2. Clear fake ISRCs (starting with QZZ)
      let tracks: any = [];
      try {
        if (release.tracks) {
          tracks = typeof release.tracks === 'string' 
            ? JSON.parse(release.tracks) 
            : release.tracks;
        }
      } catch (e) {
        console.error(`⚠️ Failed to parse tracks for release ID ${release.id}:`, e);
      }
      
      if (Array.isArray(tracks) && tracks.length > 0) {
        let tracksUpdated = false;
        const updatedTracks = tracks.map((track: any) => {
          if (track.isrc && track.isrc.toUpperCase().startsWith('QZZ')) {
            console.log(`🎵 Clearing fake ISRC "${track.isrc}" in track "${track.title}" (release: "${release.title}")`);
            tracksUpdated = true;
            isrcFixCount++;
            return {
              ...track,
              isrc: ''
            };
          }
          return track;
        });
        
        if (tracksUpdated) {
          dataToUpdate.tracks = updatedTracks;
          needsUpdate = true;
        }
      }
      
      // 3. Perform database update if needed
      if (needsUpdate) {
        await prisma.release.update({
          where: { id: release.id },
          data: dataToUpdate
        });
        totalUpdated++;
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📅 Dates corrected: ${dateFixCount}`);
    console.log(`🎵 Fake ISRCs cleared: ${isrcFixCount}`);
    console.log(`🔄 Total releases updated in DB: ${totalUpdated}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
