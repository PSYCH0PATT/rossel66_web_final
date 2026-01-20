/**
 * Полное исправление релизов:
 * 1. Удаление статуса "Новый" (замена на "Модерируется")
 * 2. Исправление неправильных артистов
 */

const fs = require('fs');
const path = require('path');
const { loadUsers, findArtistByName, loadReleases, saveReleases } = require('../lib/storage');

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

function main() {
  console.log('🔧 Полное исправление релизов...\n');
  
  const releases = loadReleases();
  const users = loadUsers();
  
  console.log(`📊 Загружено ${releases.length} релизов и ${users.length} пользователей\n`);
  
  let statusFixed = 0;
  let artistFixed = 0;
  let artistNotFound = 0;
  const artistProblems = [];
  
  releases.forEach((release, index) => {
    let changed = false;
    
    // 1. Исправляем статус "Новый"
    if (release.status === 'Новый' || release.status === 'новый') {
      release.status = normalizeStatus(release.status);
      statusFixed++;
      changed = true;
    }
    
    // 2. Проверяем и исправляем артистов
    // Если artistId выглядит как временный ID (число или user_xxx), пытаемся найти правильного
    const artistId = release.artistId;
    const artistName = release.artistName || release.title?.split(' - ')[0] || '';
    
    // Проверяем, является ли artistId временным
    const isTemporaryId = /^(user_|artist_)?\d+$/.test(artistId) || artistId === '25';
    
    if (isTemporaryId || !artistId) {
      // Пытаемся найти артиста по имени
      if (artistName) {
        const foundArtist = findArtistByName(artistName);
        if (foundArtist) {
          release.artistId = foundArtist.id;
          release.artistName = foundArtist.name || foundArtist.username;
          artistFixed++;
          changed = true;
        } else {
          artistNotFound++;
          artistProblems.push({
            title: release.title,
            artistName: artistName,
            oldId: artistId
          });
        }
      } else {
        // Пытаемся найти по названию релиза
        const titleParts = release.title?.split(' - ') || [];
        if (titleParts.length > 0) {
          const foundArtist = findArtistByName(titleParts[0]);
          if (foundArtist) {
            release.artistId = foundArtist.id;
            release.artistName = foundArtist.name || foundArtist.username;
            artistFixed++;
            changed = true;
          } else {
            artistNotFound++;
            artistProblems.push({
              title: release.title,
              artistName: 'не указан',
              oldId: artistId
            });
          }
        }
      }
    }
    
    // Обновляем updatedAt если были изменения
    if (changed) {
      release.updatedAt = new Date().toISOString();
    }
  });
  
  // Сохраняем изменения
  saveReleases(releases);
  
  console.log('💾 Сохранено\n');
  console.log('📊 Итого:');
  console.log(`   ✅ Статусов исправлено: ${statusFixed}`);
  console.log(`   ✅ Артистов исправлено: ${artistFixed}`);
  console.log(`   ⚠️  Артистов не найдено: ${artistNotFound}`);
  
  if (artistProblems.length > 0 && artistProblems.length <= 20) {
    console.log('\n⚠️  Релизы без найденных артистов:');
    artistProblems.slice(0, 10).forEach(p => {
      console.log(`   - "${p.title}" (артист: ${p.artistName})`);
    });
    if (artistProblems.length > 10) {
      console.log(`   ... и еще ${artistProblems.length - 10}`);
    }
  }
  
  console.log('\n✨ Готово!');
}

main();
