const fs = require('fs');
const path = require('path');

// Импортируем функции из storage
const { loadReleases, saveReleases, loadUsers, findArtistByName, getReleaseByKoalaId } = require('../lib/storage');

// Нормализация статуса (копируем из API)
function normalizeStatus(status) {
  const statusLower = status.toLowerCase().trim();
  
  const statusMap = {
    'новый': 'Доставлен',
    'на модерации': 'Модерируется',
    'модерируется': 'Модерируется',
    'модерация': 'Модерируется',
    'одобрен': 'Доставлен',
    'отклонён': 'Отклонен',
    'отклонен': 'Отклонен',
    'в доставке': 'В доставке',
    'доставлен': 'Доставлен',
    'снят': 'Отклонен',
    'released': 'Доставлен',
    'moderation': 'Модерируется',
    'delivery': 'В доставке',
    'scheduled': 'Модерируется',
  };
  
  return statusMap[statusLower] || 'Доставлен';
}

async function testKoalaParser() {
  console.log('📋 Тестируем обработку Koala релизов...\n');
  
  // Читаем тестовые данные
  const koalaDataPath = path.join(__dirname, '../parsers/koala_output.json');
  const koalaData = JSON.parse(fs.readFileSync(koalaDataPath, 'utf8'));
  
  console.log('📊 Тестовые релизы Koala:');
  koalaData.forEach(r => {
    console.log(`   - ${r.title} (${r.artist}) - Статус: ${r.status}`);
  });
  
  // Загружаем текущие данные
  const releases = loadReleases();
  const users = loadUsers();
  
  console.log(`\n📦 Текущее состояние БД:`);
  console.log(`   - Всего релизов: ${releases.length}`);
  console.log(`   - Всего пользователей: ${users.length}`);
  
  let added = 0;
  let updated = 0;
  let skipped = 0;
  
  console.log('\n🔄 Обрабатываем релизы...\n');
  
  for (const koalaRelease of koalaData) {
    try {
      // Ищем артиста
      const artist = findArtistByName(koalaRelease.artist);
      
      if (!artist) {
        console.log(`⏭️  Пропускаем "${koalaRelease.title}" - артист "${koalaRelease.artist}" не найден`);
        skipped++;
        continue;
      }
      
      // Проверяем, существует ли релиз
      const existingRelease = getReleaseByKoalaId(koalaRelease.koala_id);
      
      if (existingRelease) {
        // Обновляем существующий релиз
        const releaseIndex = releases.findIndex(r => r.id === existingRelease.id);
        if (releaseIndex !== -1) {
          const oldStatus = releases[releaseIndex].status;
          const newStatus = normalizeStatus(koalaRelease.status);
          
          releases[releaseIndex].status = newStatus;
          releases[releaseIndex].updatedAt = new Date().toISOString();
          
          console.log(`🔄 Обновлен релиз "${koalaRelease.title}"`);
          console.log(`   Статус: "${oldStatus}" → "${newStatus}"`);
          updated++;
        }
      } else {
        // Создаем новый релиз
        const newRelease = {
          id: `release_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: koalaRelease.title,
          artistId: artist.id,
          artistName: koalaRelease.artist,
          releaseDate: koalaRelease.release_date || new Date().toISOString().split('T')[0],
          type: koalaRelease.tracks.length > 1 ? 'album' : 'single',
          coverUrl: koalaRelease.cover_url || '',
          tracks: koalaRelease.tracks.map(track => ({
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: track.title,
            isrc: track.isrc,
            duration: track.duration
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: normalizeStatus(koalaRelease.status),
          koalaId: koalaRelease.koala_id,
          bandlinkUrl: koalaRelease.bandlink_url || undefined,
          upc: koalaRelease.upc || undefined
        };
        
        releases.push(newRelease);
        console.log(`✅ Добавлен релиз "${koalaRelease.title}"`);
        console.log(`   Статус: "${newRelease.status}"`);
        added++;
      }
    } catch (error) {
      console.error(`❌ Ошибка обработки релиза "${koalaRelease.title}":`, error);
    }
  }
  
  // Сохраняем обновленные релизы
  saveReleases(releases);
  
  console.log(`\n📊 Результаты:`);
  console.log(`   ✅ Добавлено: ${added}`);
  console.log(`   🔄 Обновлено: ${updated}`);
  console.log(`   ⏭️  Пропущено: ${skipped}`);
  
  // Проверяем результаты
  console.log(`\n📋 Проверяем результаты в БД...`);
  const finalReleases = loadReleases();
  const koalaTestReleases = finalReleases.filter(r => 
    r.koalaId && r.koalaId.startsWith('test_koala_')
  );
  
  console.log(`\n   Тестовые релизы Koala в БД:`);
  koalaTestReleases.forEach(r => {
    console.log(`      - ${r.title}`);
    console.log(`        Статус: ${r.status}`);
    console.log(`        Артист: ${r.artistName}`);
    console.log(`        Koala ID: ${r.koalaId}`);
    console.log();
  });
}

testKoalaParser().catch(console.error);
