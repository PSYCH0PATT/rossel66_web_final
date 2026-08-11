/**
 * Скрипт для автоматического сопоставления артистов у существующих релизов
 * Ищет артистов по name и username, сравнивая с данными из релизов
 */

const fs = require('fs');
const path = require('path');

// Нормализует имя артиста для сравнения
function normalizeArtistName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

// Находит артиста по имени (ищет по name и username)
// Использует ТОЛЬКО точное совпадение - никаких частичных совпадений!
function findArtistByName(artistName, users) {
  if (!artistName) return null;
  
  const normalizedSearch = normalizeArtistName(artistName);
  
  // ТОЛЬКО точное совпадение - никаких частичных!
  return users.find(user => {
    if (user.role !== 'artist') return false;
    
    const normalizedName = normalizeArtistName(user.name || '');
    const normalizedUsername = normalizeArtistName(user.username || '');
    
    // Только точное совпадение
    return normalizedName === normalizedSearch || normalizedUsername === normalizedSearch;
  }) || null;
}

// Извлекает имена артистов из различных полей релиза
function extractArtistNames(release) {
  const names = new Set();
  
  // ПРИОРИТЕТ 1: Из artistName если есть (самый надежный источник)
  if (release.artistName) {
    names.add(release.artistName);
  }
  
  // ПРИОРИТЕТ 2: Из featuredArtistNames если есть
  if (release.featuredArtistNames && Array.isArray(release.featuredArtistNames)) {
    release.featuredArtistNames.forEach(name => names.add(name));
  }
  
  // ПРИОРИТЕТ 3: Из треков (featuredArtistNames и featuredArtistIds)
  if (release.tracks && Array.isArray(release.tracks)) {
    release.tracks.forEach(track => {
      if (track.featuredArtistNames && Array.isArray(track.featuredArtistNames)) {
        track.featuredArtistNames.forEach(name => names.add(name));
      }
    });
  }
  
  // ПРИОРИТЕТ 4: Из названия релиза ТОЛЬКО если содержит явные указания на артистов
  // НЕ разбиваем название на части - это может быть название трека!
  if (release.title) {
    const title = release.title;
    
    // Ищем паттерны типа "prod.by ARTIST" или "feat. ARTIST" или "ft. ARTIST"
    const prodMatch = title.match(/(?:prod\.by|feat\.|ft\.|featuring)\s+([^&,()]+)/i);
    if (prodMatch) {
      const artistPart = prodMatch[1].trim();
      // Разбиваем только если есть несколько артистов через & или ,
      if (artistPart.includes('&') || artistPart.includes(',')) {
        artistPart.split(/[&,]/).forEach(part => {
          const trimmed = part.trim();
          if (trimmed && trimmed.length > 1) {
            names.add(trimmed);
          }
        });
      } else {
        names.add(artistPart);
      }
    }
    
    // Ищем артистов в скобках после названия: "TITLE (ARTIST1 & ARTIST2)"
    const bracketMatch = title.match(/\(([^)]+)\)/);
    if (bracketMatch) {
      const bracketContent = bracketMatch[1];
      // Если в скобках есть & или ,, то это вероятно артисты
      if (bracketContent.includes('&') || bracketContent.includes(',')) {
        bracketContent.split(/[&,]/).forEach(part => {
          const trimmed = part.trim();
          // Пропускаем короткие слова и служебные слова
          if (trimmed && trimmed.length > 2 && !trimmed.match(/^(by|prod|ft|feat)$/i)) {
            names.add(trimmed);
          }
        });
      }
    }
  }
  
  return Array.from(names).filter(name => name && name.length > 0);
}

function main() {
  console.log('🚀 Начало обновления артистов в релизах...\n');
  
  const releasesPath = path.join(__dirname, '..', 'data', 'releases.json');
  const usersPath = path.join(__dirname, '..', 'data', 'users.json');
  
  if (!fs.existsSync(releasesPath)) {
    console.error('❌ Файл releases.json не найден');
    process.exit(1);
  }
  
  if (!fs.existsSync(usersPath)) {
    console.error('❌ Файл users.json не найден');
    process.exit(1);
  }
  
  const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  
  console.log(`📊 Загружено ${releases.length} релизов и ${users.length} пользователей\n`);
  
  let updated = 0;
  let notFound = 0;
  let alreadyHasArtist = 0;
  
  for (const release of releases) {
    // Пропускаем если уже есть валидный artistId
    if (release.artistId && users.find(u => u.id === release.artistId && u.role === 'artist')) {
      alreadyHasArtist++;
      continue;
    }
    
    // Извлекаем имена артистов из релиза
    const artistNames = extractArtistNames(release);
    
    if (artistNames.length === 0) {
      console.log(`⚠️  Релиз "${release.title}" - не найдено имен артистов`);
      notFound++;
      continue;
    }
    
    // Ищем артиста
    let matchedArtist = null;
    for (const name of artistNames) {
      matchedArtist = findArtistByName(name, users);
      if (matchedArtist) {
        break;
      }
    }
    
    if (matchedArtist) {
      release.artistId = matchedArtist.id;
      release.updatedAt = new Date().toISOString();
      updated++;
      console.log(`✅ Релиз "${release.title}" → артист "${matchedArtist.name}" (${matchedArtist.username || 'нет username'})`);
    } else {
      console.log(`❌ Релиз "${release.title}" - артист не найден для имен: ${artistNames.join(', ')}`);
      notFound++;
    }
  }
  
  // Сохраняем обновленные релизы
  if (updated > 0) {
    fs.writeFileSync(releasesPath, JSON.stringify(releases, null, 2), 'utf8');
    console.log(`\n💾 Сохранено ${updated} обновлений`);
  }
  
  console.log(`\n📊 Итого:`);
  console.log(`   ✅ Обновлено: ${updated}`);
  console.log(`   ⚠️  Уже есть артист: ${alreadyHasArtist}`);
  console.log(`   ❌ Не найдено: ${notFound}`);
  console.log(`\n✨ Готово!`);
}

main();
