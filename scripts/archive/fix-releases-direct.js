/**
 * Прямое исправление релизов из файла
 */

const fs = require('fs');
const path = require('path');

// Нормализует статус
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
  };
  
  return statusMap[statusLower] || 'Модерируется';
}

// Нормализует имя артиста
function normalizeArtistName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Находит артиста по имени
function findArtistByName(artistName, users) {
  const normalizedSearch = normalizeArtistName(artistName);
  
  for (const user of users) {
    if (user.role !== 'artist') continue;
    
    const normalizedName = normalizeArtistName(user.name || '');
    const normalizedUsername = normalizeArtistName(user.username || '');
    
    if (normalizedName === normalizedSearch || normalizedUsername === normalizedSearch) {
      return user;
    }
  }
  
  return null;
}

function main() {
  console.log('🔧 Исправление релизов...\n');
  
  // Загружаем данные
  const releasesPath = path.join(__dirname, '..', 'data', 'releases.json');
  const usersPath = path.join(__dirname, '..', 'data', 'users.json');
  
  const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  
  console.log(`📊 Загружено ${releases.length} релизов и ${users.length} пользователей\n`);
  
  let statusFixed = 0;
  let artistFixed = 0;
  let artistNotFound = 0;
  const artistProblems = [];
  
  releases.forEach((release) => {
    let changed = false;
    
    // 1. Исправляем статус "Новый"
    if (release.status === 'Новый' || release.status === 'новый') {
      release.status = normalizeStatus(release.status);
      statusFixed++;
      changed = true;
    }
    
    // 2. Исправляем артистов
    const artistId = release.artistId;
    const artistName = release.artistName || '';
    
    // Проверяем, является ли artistId временным (число или user_xxx)
    const isTemporaryId = /^(user_|artist_)?\d+$/.test(artistId) || artistId === '25' || artistId === 'skaya';
    
    if (isTemporaryId || !artistId || artistId === 'skaya') {
      // Пытаемся найти артиста
      let searchName = artistName;
      
      // Если нет имени, пытаемся извлечь из названия
      if (!searchName && release.title) {
        const titleParts = release.title.split(' - ');
        if (titleParts.length > 0) {
          searchName = titleParts[0].trim();
        }
      }
      
      if (searchName) {
        const foundArtist = findArtistByName(searchName, users);
        if (foundArtist) {
          release.artistId = foundArtist.id;
          release.artistName = foundArtist.name || foundArtist.username;
          artistFixed++;
          changed = true;
        } else {
          artistNotFound++;
          artistProblems.push({
            title: release.title,
            artistName: searchName,
            oldId: artistId
          });
        }
      } else {
        artistNotFound++;
        artistProblems.push({
          title: release.title,
          artistName: 'не указан',
          oldId: artistId
        });
      }
    }
    
    // Обновляем updatedAt
    if (changed) {
      release.updatedAt = new Date().toISOString();
    }
  });
  
  // Сохраняем
  fs.writeFileSync(releasesPath, JSON.stringify(releases, null, 2), 'utf8');
  
  console.log('💾 Сохранено\n');
  console.log('📊 Итого:');
  console.log(`   ✅ Статусов исправлено: ${statusFixed}`);
  console.log(`   ✅ Артистов исправлено: ${artistFixed}`);
  console.log(`   ⚠️  Артистов не найдено: ${artistNotFound}`);
  
  if (artistProblems.length > 0 && artistProblems.length <= 20) {
    console.log('\n⚠️  Релизы без найденных артистов (первые 10):');
    artistProblems.slice(0, 10).forEach(p => {
      console.log(`   - "${p.title}" (артист: ${p.artistName}, старый ID: ${p.oldId})`);
    });
    if (artistProblems.length > 10) {
      console.log(`   ... и еще ${artistProblems.length - 10}`);
    }
  }
  
  console.log('\n✨ Готово!');
}

main();
