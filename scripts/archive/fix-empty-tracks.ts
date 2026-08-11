import { prisma } from '../../lib/prisma';

async function main() {
  console.log('🚀 Starting script to fix empty tracks in the database...');
  
  try {
    const releases = await prisma.release.findMany();
    console.log(`📊 Found ${releases.length} total releases in the database.`);
    
    let fixCount = 0;
    
    for (const release of releases) {
      // Parse tracks
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
      
      // Check if tracks array is empty or not an array
      if (!Array.isArray(tracks) || tracks.length === 0) {
        console.log(`🔧 Release "${release.title}" (ID: ${release.id}) has empty tracks. Fixing...`);
        
        const defaultTrack = [
          {
            id: `track_${Date.now()}_0`,
            title: release.title,
            duration: '0:00',
            isrc: ''
          }
        ];
        
        await prisma.release.update({
          where: { id: release.id },
          data: {
            tracks: defaultTrack
          }
        });
        
        console.log(`   ✅ Fixed release "${release.title}"`);
        fixCount++;
      }
    }
    
    console.log(`\n🎉 Script finished! Fixed ${fixCount} releases with empty tracks.`);
  } catch (error) {
    console.error('❌ Error executing script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
