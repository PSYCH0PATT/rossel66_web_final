/**
 * Скрипт для проверки статусов релизов после парсинга Koala и Zvonko
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
  console.log('📊 Проверка статусов релизов после парсинга\n');
  console.log('='.repeat(60));
  
  // Проверяем Koala парсер
  const koalaOutput = path.join(__dirname, '..', 'parsers', 'koala_output.json');
  if (fs.existsSync(koalaOutput)) {
    console.log('\n🎵 KOALA PARSER:\n');
    try {
      const koalaReleases = JSON.parse(fs.readFileSync(koalaOutput, 'utf8'));
      console.log(`   Найдено релизов: ${koalaReleases.length}\n`);
      
      koalaReleases.forEach((release, index) => {
        const originalStatus = release.status || 'нет статуса';
        const normalized = normalizeStatus(originalStatus);
        const statusOk = originalStatus === normalized || normalized === 'Модерируется';
        
        console.log(`   ${index + 1}. "${release.title}"`);
        console.log(`      Артист: ${release.artist}`);
        console.log(`      Статус: "${originalStatus}" → "${normalized}" ${statusOk ? '✅' : '⚠️'}`);
        console.log('');
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
      console.log(`   Найдено релизов: ${zvonkoReleases.length}\n`);
      
      // Показываем первые 20 релизов
      zvonkoReleases.slice(0, 20).forEach((release, index) => {
        const originalStatus = release.status || 'нет статуса';
        const normalized = normalizeStatus(originalStatus);
        const statusOk = originalStatus === normalized || normalized === 'Модерируется';
        
        console.log(`   ${index + 1}. "${release.title}"`);
        console.log(`      Артист: ${release.artist}`);
        console.log(`      Статус: "${originalStatus}" → "${normalized}" ${statusOk ? '✅' : '⚠️'}`);
        console.log('');
      });
      
      if (zvonkoReleases.length > 20) {
        console.log(`   ... и еще ${zvonkoReleases.length - 20} релизов\n`);
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
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Проверка завершена!');
}

main();
