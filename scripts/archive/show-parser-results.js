/**
 * Скрипт для вывода результатов парсинга Koala и Zvonko с проверкой статусов
 */

const fs = require('fs');
const path = require('path');

// Нормализует статус (как в API)
function normalizeStatus(status) {
  if (!status) return 'Модерируется';
  
  const statusLower = status.toLowerCase().trim();
  
  const statusMap = {
    'новый': 'Модерируется',
    'на модерации': 'Модерируется',
    'модерируется': 'Модерируется',
    'модерация': 'Модерируется',
    'одобрен': 'Модерируется',
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
  
  return statusMap[statusLower] || 'Модерируется';
}

function main() {
  console.log('📊 РЕЗУЛЬТАТЫ ПАРСИНГА KOALA И ZVONKO\n');
  console.log('='.repeat(80));
  
  // Проверяем Koala парсер
  const koalaOutput = path.join(__dirname, '..', 'parsers', 'koala_output.json');
  if (fs.existsSync(koalaOutput)) {
    console.log('\n🎵 KOALA PARSER:\n');
    try {
      const koalaReleases = JSON.parse(fs.readFileSync(koalaOutput, 'utf8'));
      console.log(`   Всего релизов: ${koalaReleases.length}\n`);
      
      koalaReleases.forEach((release, index) => {
        const originalStatus = release.status || 'нет статуса';
        const normalized = normalizeStatus(originalStatus);
        const statusOk = normalized === 'Модерируется' || normalized === 'Отклонен' || normalized === 'В доставке' || normalized === 'Доставлен';
        
        console.log(`   ${index + 1}. "${release.title}"`);
        console.log(`      Артист: ${release.artist}`);
        console.log(`      Статус: "${originalStatus}" → "${normalized}" ${statusOk ? '✅' : '⚠️'}`);
        console.log('');
      });
      
      // Группируем по статусам
      const statusGroups = {};
      koalaReleases.forEach(r => {
        const normalized = normalizeStatus(r.status || 'нет статуса');
        if (!statusGroups[normalized]) statusGroups[normalized] = [];
        statusGroups[normalized].push(r);
      });
      
      console.log('\n📊 Статистика по статусам (Koala):');
      Object.entries(statusGroups).forEach(([status, items]) => {
        console.log(`   ${status}: ${items.length} релизов`);
      });
      
    } catch (e) {
      console.log(`   ❌ Ошибка чтения: ${e.message}`);
    }
  } else {
    console.log('\n🎵 KOALA PARSER: файл не найден\n');
  }
  
  // Проверяем Zvonko парсер
  const zvonkoOutput = path.join(__dirname, '..', 'parsers', 'zvonko_all_releases_full.json');
  if (fs.existsSync(zvonkoOutput)) {
    console.log('\n🎵 ZVONKO PARSER:\n');
    try {
      const zvonkoReleases = JSON.parse(fs.readFileSync(zvonkoOutput, 'utf8'));
      console.log(`   Всего релизов: ${zvonkoReleases.length}\n`);
      
      // Показываем релизы со статусами (первые 30)
      const releasesWithStatus = zvonkoReleases.filter(r => r.status).slice(0, 30);
      const releasesWithoutStatus = zvonkoReleases.filter(r => !r.status).length;
      
      if (releasesWithStatus.length > 0) {
        console.log(`   Релизы со статусами (${releasesWithStatus.length}):\n`);
        releasesWithStatus.forEach((release, index) => {
          const originalStatus = release.status;
          const normalized = normalizeStatus(originalStatus);
          const statusOk = normalized === 'Модерируется' || normalized === 'Отклонен' || normalized === 'В доставке' || normalized === 'Доставлен';
          
          console.log(`   ${index + 1}. "${release.title}"`);
          console.log(`      Артист: ${release.artist}`);
          console.log(`      Статус: "${originalStatus}" → "${normalized}" ${statusOk ? '✅' : '⚠️'}`);
          console.log('');
        });
      }
      
      if (releasesWithoutStatus > 0) {
        console.log(`\n   ⚠️  Релизов без статуса: ${releasesWithoutStatus} (будут установлены как "Модерируется")\n`);
      }
      
      // Группируем по статусам
      const statusGroups = {};
      zvonkoReleases.forEach(r => {
        const normalized = normalizeStatus(r.status || 'нет статуса');
        if (!statusGroups[normalized]) statusGroups[normalized] = [];
        statusGroups[normalized].push(r);
      });
      
      console.log('\n📊 Статистика по статусам (Zvonko):');
      Object.entries(statusGroups).forEach(([status, items]) => {
        console.log(`   ${status}: ${items.length} релизов`);
      });
      
    } catch (e) {
      console.log(`   ❌ Ошибка чтения: ${e.message}`);
    }
  } else {
    console.log('\n🎵 ZVONKO PARSER: файл не найден\n');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Проверка завершена!');
  console.log('\n📝 Вывод:');
  console.log('   - Все статусы нормализуются к: Модерируется, Отклонен, В доставке, Доставлен');
  console.log('   - При следующем парсинге через API статусы будут нормализованы автоматически');
  console.log('   - Артисты будут сопоставляться автоматически по точному совпадению имен\n');
}

main();
