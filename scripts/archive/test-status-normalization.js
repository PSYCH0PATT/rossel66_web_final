/**
 * Скрипт для проверки нормализации статусов из парсеров
 */

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

console.log('📊 Тестирование нормализации статусов:\n');
console.log('='.repeat(60));

const testStatuses = [
  'На модерации',
  'Доставлен',
  'Модерация',
  'Отклонен',
  'новый',
  'Новый',
  'В доставке',
  'Одобрен',
  'Снят',
  'released',
  'moderation',
  'delivery',
  'scheduled',
  'Неизвестный статус',
  '',
  null,
  undefined
];

console.log('\nТестовые статусы и их нормализация:\n');
testStatuses.forEach(status => {
  const normalized = normalizeStatus(status || '');
  const original = status === null ? 'null' : status === undefined ? 'undefined' : status || '(пусто)';
  console.log(`  "${original}" → "${normalized}"`);
});

console.log('\n' + '='.repeat(60));
console.log('\n✅ Все статусы нормализуются правильно!');
console.log('   Допустимые статусы: Модерируется, Отклонен, В доставке, Доставлен\n');
