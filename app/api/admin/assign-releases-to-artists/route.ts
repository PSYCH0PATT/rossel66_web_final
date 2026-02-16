import { NextResponse } from 'next/server';
import { loadUsers, assignReleasesToNewArtist } from '@/lib/storage';

/**
 * POST /api/admin/assign-releases-to-artists
 * Привязывает релизы без artistId ко всем артистам по имени
 */
export async function POST() {
  try {
    console.log('🔍 Загрузка списка артистов...');
    const users = await loadUsers();
    const artists = users.filter(u => u.role === 'artist');
    
    console.log(`📋 Найдено артистов: ${artists.length}`);
    
    let totalAssigned = 0;
    let artistsWithAssignments = 0;
    const results: { artist: string; assigned: number }[] = [];
    
    for (const artist of artists) {
      try {
        const artistName = artist.name || '';
        const username = artist.username || '';
        
        if (!artistName && !username) {
          console.log(`⚠️  Пропуск артиста ${artist.id}: нет имени и username`);
          continue;
        }
        
        // Пытаемся привязать релизы
        const assignedCount = await assignReleasesToNewArtist(
          artist.id,
          artistName,
          username
        );
        
        if (assignedCount > 0) {
          artistsWithAssignments++;
          totalAssigned += assignedCount;
          results.push({
            artist: artistName || username,
            assigned: assignedCount
          });
          console.log(`✅ ${artistName || username}: привязано ${assignedCount} релиз(ов)`);
        }
      } catch (error) {
        console.error(`❌ Ошибка для артиста ${artist.name || artist.username}:`, error);
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Готово!`);
    console.log(`   Артистов обработано: ${artists.length}`);
    console.log(`   Артистов с привязками: ${artistsWithAssignments}`);
    console.log(`   Всего привязано релизов: ${totalAssigned}`);
    console.log('═══════════════════════════════════════════════════');
    
    return NextResponse.json({
      success: true,
      message: `Привязано ${totalAssigned} релиз(ов) к ${artistsWithAssignments} артист(ам)`,
      stats: {
        totalArtists: artists.length,
        artistsWithAssignments,
        totalAssigned
      },
      details: results
    });
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error)
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
