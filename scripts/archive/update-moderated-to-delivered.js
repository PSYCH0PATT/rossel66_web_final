/**
 * Скрипт для обновления статуса "Модерируется" на "Доставлен"
 */

const fs = require('fs');
const path = require('path');

function main() {
  console.log('🚀 Начало обновления статусов "Модерируется" → "Доставлен"...\n');
  
  const releasesPath = path.join(__dirname, '..', 'data', 'releases.json');
  
  if (!fs.existsSync(releasesPath)) {
    console.error('❌ Файл releases.json не найден');
    process.exit(1);
  }
  
  const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
  
  console.log(`📊 Загружено ${releases.length} релизов\n`);
  
  let updated = 0;
  
  for (const release of releases) {
    if (release.status === 'Модерируется') {
      release.status = 'Доставлен';
      release.updatedAt = new Date().toISOString();
      updated++;
    }
  }
  
  // Сохраняем обновленные релизы
  if (updated > 0) {
    fs.writeFileSync(releasesPath, JSON.stringify(releases, null, 2), 'utf8');
    console.log(`💾 Обновлено ${updated} релизов со статусом "Модерируется" → "Доставлен"`);
  } else {
    console.log('✅ Релизов со статусом "Модерируется" не найдено');
  }
  
  console.log(`\n✨ Готово!`);
}

main();
