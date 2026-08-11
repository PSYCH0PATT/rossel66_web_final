/**
 * Скрипт для проверки статусов релизов после парсинга
 */

const fs = require('fs');
const path = require('path');

// Нормализует статус релиза к стандартным значениям (как в API)
function normalizeStatus(status) {
  if (!status) return 'Модерируется';
  
  const statusLower = status.toLowerCase().trim();
  
  const statusMap = {
    'новый': 'Модерируется',
    'на модерации': 'Модерируется',
    'модерируется': 'Модерируется',
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
  console.log('📊 Проверка статусов релизов после парсинга\n');
  
  const releasesPath = path.join(__dirname, '..', 'data', 'releases.json');
  
  if (!fs.existsSync(releasesPath)) {
    console.error('❌ Файл releases.json не найден');
    process.exit(1);
  }
  
  const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
  
  console.log(`📊 Всего релизов: ${releases.length}\n`);
  
  // Группируем по статусам
  const statusCounts = {};
  const invalidStatuses = [];
  
  releases.forEach(release => {
    const status = release.status || 'нет статуса';
    const normalized = normalizeStatus(status);
    
    if (!statusCounts[normalized]) {
      statusCounts[normalized] = [];
    }
    statusCounts[normalized].push({
      title: release.title,
      artistId: release.artistId,
      originalStatus: status,
      normalizedStatus: normalized
    });
    
    // Проверяем, что статус нормализован правильно
    if (status !== normalized && status !== 'нет статуса') {
      invalidStatuses.push({
        title: release.title,
        original: status,
        normalized: normalized
      });
    }
  });
  
  console.log('📊 Статусы релизов:\n');
  Object.entries(statusCounts).forEach(([status, items]) => {
    console.log(`   ${status}: ${items.length} релизов`);
  });
  
  if (invalidStatuses.length > 0) {
    console.log(`\n⚠️  Найдено ${invalidStatuses.length} релизов с ненормализованными статусами:\n`);
    invalidStatuses.slice(0, 10).forEach(item => {
      console.log(`   "${item.title}": "${item.original}" → "${item.normalized}"`);
    });
    if (invalidStatuses.length > 10) {
      console.log(`   ... и еще ${invalidStatuses.length - 10}`);
    }
  }
  
  // Показываем примеры релизов с разными статусами
  console.log('\n📋 Примеры релизов по статусам:\n');
  Object.entries(statusCounts).forEach(([status, items]) => {
    if (items.length > 0) {
      console.log(`\n${status} (${items.length}):`);
      items.slice(0, 3).forEach(item => {
        console.log(`   - "${item.title}" (артист: ${item.artistId || 'не указан'})`);
      });
      if (items.length > 3) {
        console.log(`   ... и еще ${items.length - 3}`);
      }
    }
  });
  
  // Проверяем релизы без артистов
  const releasesWithoutArtists = releases.filter(r => !r.artistId);
  if (releasesWithoutArtists.length > 0) {
    console.log(`\n⚠️  Релизов без артистов: ${releasesWithoutArtists.length}`);
    releasesWithoutArtists.slice(0, 5).forEach(r => {
      console.log(`   - "${r.title}" (статус: ${r.status || 'нет'})`);
    });
  }
  
  console.log('\n✨ Проверка завершена!');
}

main();
