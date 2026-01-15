#!/usr/bin/env python3
"""
Добавление только релизов с Koala (без дубликатов)
"""

import json
import os
from datetime import datetime
import uuid
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def generate_isrc():
    """Генерирует ISRC код"""
    import random
    import string
    
    country = "RU"
    year = f"{datetime.now().year % 100:02d}"
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{country}{year}{suffix}"

def load_releases():
    """Загружает текущие релизы"""
    try:
        with open('data/releases.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_releases(releases):
    """Сохраняет релизы"""
    with open('data/releases.json', 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)

def load_koala_releases():
    """Загружает релизы с Koala"""
    try:
        with open('parsers/koala_output.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("❌ Файл koala_output.json не найден")
        return []

def koala_exists(koala_id, releases):
    """Проверяет, существует ли релиз с таким koala_id"""
    for release in releases:
        if release.get('koalaId') == koala_id:
            return True
    return False

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

def add_koala_releases():
    """Добавляет только новые релизы с Koala"""
    
    logger.info("🎵 Начинаем добавление релизов с Koala...")
    
    # Загружаем текущие релизы
    current_releases = load_releases()
    logger.info(f"📁 Текущее количество релизов: {len(current_releases)}")
    
    # Загружаем релизы с Koala
    koala_releases = load_koala_releases()
    logger.info(f"📊 Найдено релизов с Koala: {len(koala_releases)}")
    
    # Создаем бэкап
    backup_file = f"data/releases_backup_{int(datetime.now().timestamp())}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(current_releases, f, ensure_ascii=False, indent=2)
    logger.info(f"💾 Бэкап сохранен: {backup_file}")
    
    # Считаем существующие koala_id
    existing_koala_ids = set()
    for release in current_releases:
        if release.get('koalaId'):
            existing_koala_ids.add(release['koalaId'])
    
    logger.info(f"🔍 Уже существующих Koala релизов: {len(existing_koala_ids)}")
    
    # Добавляем только новые релизы с Koala
    added_count = 0
    skipped_count = 0
    
    for koala_release in koala_releases:
        koala_id = koala_release.get('koala_id')
        
        if koala_id in existing_koala_ids:
            skipped_count += 1
            logger.info(f"⏭️  Пропускаем существующий: {koala_release['title']} - {koala_release['artist']}")
            continue
        
        # Создаем новый релиз
        new_release = {
            "id": f"release_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
            "artistId": f"artist_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
            "artistName": koala_release['artist'],
            "title": koala_release['title'],
            "coverUrl": koala_release.get('cover_url', ''),
            "upc": koala_release.get('upc', ''),
            "releaseDate": convert_date(koala_release['release_date']),
            "status": koala_release['status'],
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "koalaId": koala_id,
            "bandlinkUrl": koala_release.get('bandlink_url', ''),
            "isrcCodes": koala_release.get('isrc_codes', []),
            "tracks": []
        }
        
        # Добавляем треки с ISRC кодами
        for i, isrc in enumerate(koala_release.get('isrc_codes', [])):
            track = {
                "id": f"track_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
                "title": f"Track {i+1}",
                "isrc": isrc,
                "duration": "0:00",
                "trackNumber": i + 1,
                "explicit": False,
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }
            new_release["tracks"].append(track)
        
        # Если нет ISRC кодов, добавляем один трек
        if not new_release["tracks"]:
            track = {
                "id": f"track_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}",
                "title": koala_release['title'],
                "isrc": generate_isrc(),
                "duration": "0:00",
                "trackNumber": 1,
                "explicit": False,
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }
            new_release["tracks"].append(track)
        
        # Добавляем релиз
        current_releases.append(new_release)
        added_count += 1
        logger.info(f"✅ Добавлен: {koala_release['title']} - {koala_release['artist']}")
    
    # Сохраняем результат
    save_releases(current_releases)
    
    # Создаем отчет
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "total_koala": len(koala_releases),
            "existing": skipped_count,
            "added": added_count,
            "total_after": len(current_releases)
        },
        "added_releases": [
            {
                "title": r['title'],
                "artist": r['artist'],
                "koala_id": r['koala_id']
            }
            for r in koala_releases 
            if r['koala_id'] not in existing_koala_ids
        ]
    }
    
    with open('parsers/koala_add_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    logger.info(f"""
🎉 Добавление Koala релизов завершено!
📊 Статистика:
  ✅ Добавлено: {added_count}
  ⏭️  Пропущено (существуют): {skipped_count}
  📁 Всего релизов в системе: {len(current_releases)}
📄 Отчет сохранен: parsers/koala_add_report.json
""")

if __name__ == "__main__":
    add_koala_releases()
