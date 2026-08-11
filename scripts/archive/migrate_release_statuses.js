#!/usr/bin/env node
/**
 * Скрипт миграции статусов релизов
 * Преобразует старые статусы в новые из Koala Music
 * 
 * Маппинг:
 * - released → Доставлен
 * - moderation → На модерации
 * - delivery → В доставке
 * - scheduled → На модерации
 */

const fs = require('fs');
const path = require('path');

const RELEASES_FILE = path.join(__dirname, '..', 'data', 'releases.json');

// Маппинг старых статусов на новые
const STATUS_MAPPING = {
  'released': 'Доставлен',
  'moderation': 'На модерации',
  'delivery': 'В доставке',
  'scheduled': 'На модерации'
};

function migrateStatuses() {
  console.log('🚀 Начинаем миграцию статусов релизов...\n');
  
  // Проверяем существование файла
  if (!fs.existsSync(RELEASES_FILE)) {
    console.log('❌ Файл releases.json не найден');
    return;
  }
  
  // Читаем релизы
  const data = fs.readFileSync(RELEASES_FILE, 'utf8');
  const releases = JSON.parse(data);
  
  console.log(`📦 Найдено релизов: ${releases.length}\n`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  // Мигрируем статусы
  const migratedReleases = releases.map(release => {
    const oldStatus = release.status;
    
    // Если статус уже новый (на русском), пропускаем
    if (!STATUS_MAPPING[oldStatus]) {
      skippedCount++;
      return release;
    }
    
    const newStatus = STATUS_MAPPING[oldStatus];
    migratedCount++;
    
    console.log(`  ✅ "${release.title}" (${release.id}): ${oldStatus} → ${newStatus}`);
    
    return {
      ...release,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
  });
  
  // Сохраняем результат
  fs.writeFileSync(RELEASES_FILE, JSON.stringify(migratedReleases, null, 2));
  
  console.log('\n📊 Результаты миграции:');
  console.log(`  - Мигрировано: ${migratedCount}`);
  console.log(`  - Пропущено (уже новый статус): ${skippedCount}`);
  console.log(`  - Всего: ${releases.length}`);
  console.log('\n✅ Миграция завершена успешно!');
}

// Запуск
migrateStatuses();


