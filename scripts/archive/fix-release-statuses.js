/**
 * Скрипт для обновления статусов релизов
 * Заменяет "новый"/"Новый" на "Модерируется" и нормализует другие статусы
 */

const fs = require('fs');
const path = require('path');

// Нормализует статус релиза к стандартным значениям
function normalizeStatus(status) {
  if (!status) return 'Модерируется';
  
  const statusLower = status.toLowerCase().trim();
  
  // Маппинг старых статусов на новые
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
  console.log('🚀 Начало обновления статусов релизов...\n');
  
  const releasesPath = path.join(__dirname, '..', 'data', 'releases.json');
  
  if (!fs.existsSync(releasesPath)) {
    console.error('❌ Файл releases.json не найден');
    process.exit(1);
  }
  
  const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
  
  console.log(`📊 Загружено ${releases.length} релизов\n`);
  
  let updated = 0;
  const statusChanges = {};
  
  for (const release of releases) {
    const oldStatus = release.status || 'нет статуса';
    const newStatus = normalizeStatus(oldStatus);
    
    if (oldStatus !== newStatus) {
      release.status = newStatus;
      release.updatedAt = new Date().toISOString();
      updated++;
      
      // Подсчитываем изменения
      const changeKey = `${oldStatus} → ${newStatus}`;
      statusChanges[changeKey] = (statusChanges[changeKey] || 0) + 1;
    }
  }
  
  // Сохраняем обновленные релизы
  if (updated > 0) {
    fs.writeFileSync(releasesPath, JSON.stringify(releases, null, 2), 'utf8');
    console.log(`💾 Сохранено ${updated} обновлений\n`);
    
    console.log('📊 Изменения статусов:');
    Object.entries(statusChanges).forEach(([change, count]) => {
      console.log(`   ${change}: ${count}`);
    });
  } else {
    console.log('✅ Все статусы уже нормализованы');
  }
  
  console.log(`\n✨ Готово!`);
}

main();
