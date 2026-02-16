/**
 * Скрипт для привязки релизов к автоматически созданным артистам
 * Проходит по всем артистам и привязывает релизы без artistId по имени артиста
 */

import { loadUsers, assignReleasesToNewArtist } from '../lib/storage';

async function main() {
  try {
    console.log('🔍 Загрузка списка артистов...');
    const users = await loadUsers();
    const artists = users.filter(u => u.role === 'artist');
    
    console.log(`📋 Найдено артистов: ${artists.length}`);
    console.log('');
    
    let totalAssigned = 0;
    let artistsWithAssignments = 0;
    
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
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

main();
