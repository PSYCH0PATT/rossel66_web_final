#!/usr/bin/env python3
"""
Исправление дат у существующих Koala релизов
"""

import json
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def convert_date(date_str):
    """Конвертирует дату из формата DD.MM.YYYY в YYYY-MM-DD"""
    if not date_str:
        return None
    
    try:
        if '.' in date_str:
            # Формат DD.MM.YYYY
            parts = date_str.split('.')
            if len(parts) == 3:
                day, month, year = parts
                return f"{year.zfill(4)}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str
    except Exception:
        return date_str

def fix_koala_dates():
    """Исправляет даты у Koala релизов"""
    
    logger.info("🔧 Исправляем даты у Koala релизов...")
    
    # Загружаем релизы
    with open('data/releases.json', 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    logger.info(f"📁 Всего релизов: {len(releases)}")
    
    # Создаем бэкап
    backup_file = f"data/releases_backup_{int(__import__('datetime').datetime.now().timestamp())}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    logger.info(f"💾 Бэкап сохранен: {backup_file}")
    
    # Исправляем даты у Koala релизов
    fixed_count = 0
    
    for release in releases:
        if release.get('koalaId'):
            old_date = release.get('releaseDate')
            if old_date and '.' in old_date:
                new_date = convert_date(old_date)
                if new_date != old_date:
                    release['releaseDate'] = new_date
                    fixed_count += 1
                    logger.info(f"📅 Исправлена дата: {old_date} → {new_date} ({release['title']})")
    
    # Сохраняем результат
    with open('data/releases.json', 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    logger.info(f"""
✅ Исправление дат завершено!
📊 Статистика:
  🔧 Исправлено дат: {fixed_count}
  📁 Всего релизов: {len(releases)}
""")

if __name__ == "__main__":
    fix_koala_dates()
