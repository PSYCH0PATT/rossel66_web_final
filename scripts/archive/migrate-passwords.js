#!/usr/bin/env node
/**
 * Скрипт миграции паролей из plaintext в bcrypt хеши
 * 
 * ВАЖНО: Запустите этот скрипт ОДИН РАЗ после деплоя!
 * 
 * Использование:
 *   node scripts/migrate-passwords.js
 * 
 * Что делает:
 * 1. Читает data/users.json
 * 2. Хеширует все plaintext пароли через bcrypt
 * 3. Сохраняет обновленный файл
 * 4. Создает бэкап оригинального файла
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const BACKUP_FILE = path.join(__dirname, '..', 'data', `users_before_migration_${Date.now()}.json`);

async function migratePasswords() {
  console.log('🔐 Начинаю миграцию паролей...\n');

  // Проверяем наличие файла
  if (!fs.existsSync(USERS_FILE)) {
    console.error('❌ Файл users.json не найден!');
    process.exit(1);
  }

  // Читаем пользователей
  const usersData = fs.readFileSync(USERS_FILE, 'utf8');
  const users = JSON.parse(usersData);

  console.log(`📋 Найдено пользователей: ${users.length}\n`);

  // Создаем бэкап
  fs.writeFileSync(BACKUP_FILE, usersData);
  console.log(`💾 Бэкап создан: ${BACKUP_FILE}\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  // Хешируем пароли
  for (const user of users) {
    // Проверяем, захеширован ли уже пароль (bcrypt хеши начинаются с $2)
    if (user.password && user.password.startsWith('$2')) {
      console.log(`⏭️  ${user.username}: пароль уже захеширован`);
      skippedCount++;
      continue;
    }

    if (!user.password) {
      console.log(`⚠️  ${user.username}: пароль отсутствует`);
      skippedCount++;
      continue;
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
    migratedCount++;
    console.log(`✅ ${user.username}: пароль захеширован`);
  }

  // Сохраняем обновленный файл
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Миграция завершена!`);
  console.log(`   Захешировано: ${migratedCount}`);
  console.log(`   Пропущено: ${skippedCount}`);
  console.log('═══════════════════════════════════════\n');

  console.log('⚠️  ВАЖНО: Удалите бэкап файл после проверки работоспособности!');
  console.log(`   rm "${BACKUP_FILE}"\n`);
}

migratePasswords().catch(err => {
  console.error('❌ Ошибка миграции:', err);
  process.exit(1);
});
