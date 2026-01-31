#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Добавление новых релизов из Zvonko в систему
"""

import json
import uuid
from datetime import datetime
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_comparison_results():
    """Загружает результаты сравнения"""
    try:
        with open('/Users/macbook/proga/rossel-music/parsers/comparison_results.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки результатов сравнения: {e}")
        return None

def load_system_releases():
    """Загружает существующие релизы системы"""
    try:
        with open('/Users/macbook/proga/rossel-music/data/releases.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки системных релизов: {e}")
        return []

def load_system_users():
    """Загружает пользователей системы"""
    try:
        with open('/Users/macbook/proga/rossel-music/data/users.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки пользователей: {e}")
        return []

def normalize_status(status):
    """Нормализует статус релиза"""
    if not status:
        return 'Доставлен'
    
    status_lower = status.lower().strip()
    
    status_map = {
        'новый': 'Доставлен',
        'неизвестен': 'Доставлен',  # "Неизвестен" → "Доставлен"
        'на модерации': 'Модерируется',
        'модерируется': 'Модерируется',
        'модерация': 'Модерируется',  # "Модерация" → "Модерируется"
        'одобрен': 'Доставлен',
        'отклонён': 'Отклонен',
        'отклонен': 'Отклонен',  # "Отклонен" остается "Отклонен"
        'в доставке': 'В доставке',
        'доставлен': 'Доставлен',
        'снят': 'Отклонен',
    }
    
    return status_map.get(status_lower, 'Доставлен')

def create_release_from_zvonko(zvonko_release, users):
    """Создает релиз в формате системы из данных Zvonko"""
    
    # Ищем пользователя по имени артиста или создаем тестового
    artist_name = zvonko_release.get('artist', 'Unknown Artist')
    artist_id = None
    
    # Нормализует имя артиста для сравнения
    def normalize_artist_name(name):
        if not name:
            return ''
        return name.lower().strip().replace(' ', ' ').replace('  ', ' ')
    
    # Ищем существующего пользователя по точному совпадению name или username
    normalized_search = normalize_artist_name(artist_name)
    artist_id = None
    
    for user in users:
        if user.get('role') != 'artist':
            continue
        
        normalized_name = normalize_artist_name(user.get('name', ''))
        normalized_username = normalize_artist_name(user.get('username', ''))
        
        # Только точное совпадение
        if normalized_name == normalized_search or normalized_username == normalized_search:
            artist_id = user.get('id')
            break
    
    # ВАЖНО: artistName - это просто текст для отображения, не связан с artistId
    # Если артист не найден, все равно создаем релиз, но artistId будет None
    # artistName всегда берется из парсера (zvonko_release.get('artist'))
    if not artist_id:
        logger.warning(f"⚠️  Артист '{artist_name}' не найден в системе. Релиз будет создан с artistId=None, но artistName будет заполнен.")
    
    # Создаем релиз
    release_id = f"release_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:8]}"
    
    # Создаем трек (базовый трек на основе названия релиза)
    track_id = f"track_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:8]}"
    
    # Определяем ISRC на основе UPC (если есть)
    isrc = f"QZZ{datetime.now().strftime('%y%m')}{''.join([str(ord(c)) for c in artist_name[:3]])[:5]}"
    if len(isrc) > 8:
        isrc = isrc[:8]
    elif len(isrc) < 8:
        isrc = isrc.ljust(8, '0')
    
    # artistName всегда берется из парсера, даже если артист не найден
    display_artist_name = zvonko_release.get('artist', artist_name)
    
    release = {
        "id": release_id,
        "artistId": artist_id if artist_id else None,  # Может быть None, если артист не найден
        "artistName": display_artist_name,  # Всегда заполняем из парсера
        "title": zvonko_release.get('title', ''),
        "coverUrl": zvonko_release.get('cover', ''),
        "upc": zvonko_release.get('upc', ''),
        "releaseDate": zvonko_release.get('date', ''),
        "status": normalize_status(zvonko_release.get('status', 'Доставлен')),  # Нормализуем статус из парсера
        "genre": zvonko_release.get('genre', ''),
        "label": zvonko_release.get('label', ''),
        "territories": zvonko_release.get('territories', ''),
        "platforms": zvonko_release.get('platforms', ''),
        "tracks": [
            {
                "id": track_id,
                "title": zvonko_release.get('title', ''),
                "isrc": isrc,
                "duration": "3:30"  # Стандартная длительность
            }
        ],
        "createdAt": datetime.now().isoformat() + "Z",
        "updatedAt": datetime.now().isoformat() + "Z",
        "zvonko_data": {  # Сохраняем исходные данные из Zvonko
            "page": zvonko_release.get('page'),
            "position_on_page": zvonko_release.get('position_on_page'),
            "artist": zvonko_release.get('artist'),
            "label": zvonko_release.get('label'),
            "territories": zvonko_release.get('territories'),
            "platforms": zvonko_release.get('platforms'),
            "genre": zvonko_release.get('genre')
        }
    }
    
    return release

def add_new_releases():
    """Добавляет новые релизы в систему"""
    logger.info("🚀 Начало добавления новых релизов...")
    
    # Загружаем данные
    comparison_results = load_comparison_results()
    if not comparison_results:
        return False
    
    system_releases = load_system_releases()
    if not system_releases:
        return False
    
    users = load_system_users()
    if not users:
        return False
    
    new_releases_data = comparison_results.get('new_releases', [])
    existing_by_upc = comparison_results.get('existing_by_upc', [])
    existing_by_title = comparison_results.get('existing_by_title', [])
    
    logger.info(f"📊 Найдено {len(new_releases_data)} новых релизов для добавления")
    logger.info(f"🔄 Найдено {len(existing_by_upc)} существующих релизов (по UPC) для обновления")
    logger.info(f"🔄 Найдено {len(existing_by_title)} существующих релизов (по названию) для обновления")
    
    # Обновляем существующие релизы - ВСЕ поля, которые могут измениться
    updated_count = 0
    for item in existing_by_upc + existing_by_title:
        try:
            zvonko_release = item['zvonko']
            system_release = item['system']
            
            # Находим релиз в системе
            release_index = None
            for i, r in enumerate(system_releases):
                if r.get('id') == system_release.get('id'):
                    release_index = i
                    break
            
            if release_index is not None:
                has_changes = False
                release = system_releases[release_index]
                
                # Нормализуем статус из парсера
                zvonko_status = zvonko_release.get('status', '')
                normalized_status = normalize_status(zvonko_status)
                
                # Обновляем статус, если он изменился
                old_status = release.get('status', '')
                if old_status != normalized_status:
                    release['status'] = normalized_status
                    has_changes = True
                    logger.info(f"🔄 Обновлен статус: '{old_status}' → '{normalized_status}'")
                
                # Обновляем дату релиза, если она изменилась
                new_date = zvonko_release.get('date', '')
                old_date = release.get('releaseDate', '')
                if new_date and new_date != old_date:
                    release['releaseDate'] = new_date
                    has_changes = True
                    logger.info(f"🔄 Обновлена дата релиза: '{old_date}' → '{new_date}'")
                
                # Обновляем обложку, если она изменилась
                new_cover = zvonko_release.get('cover', '')
                old_cover = release.get('coverUrl', '')
                if new_cover and new_cover != old_cover:
                    release['coverUrl'] = new_cover
                    has_changes = True
                    logger.info(f"🔄 Обновлена обложка")
                
                # Обновляем artistName, если он изменился
                new_artist = zvonko_release.get('artist', '')
                old_artist = release.get('artistName', '')
                if new_artist and new_artist != old_artist:
                    release['artistName'] = new_artist
                    has_changes = True
                    logger.info(f"🔄 Обновлен артист: '{old_artist}' → '{new_artist}'")
                
                # Обновляем UPC, если он изменился
                new_upc = zvonko_release.get('upc', '')
                old_upc = release.get('upc', '')
                if new_upc and new_upc != old_upc:
                    release['upc'] = new_upc
                    has_changes = True
                    logger.info(f"🔄 Обновлен UPC: '{old_upc}' → '{new_upc}'")
                
                # Обновляем жанр, если он изменился
                new_genre = zvonko_release.get('genre', '')
                old_genre = release.get('genre', '')
                if new_genre and new_genre != old_genre:
                    release['genre'] = new_genre
                    has_changes = True
                    logger.info(f"🔄 Обновлен жанр: '{old_genre}' → '{new_genre}'")
                
                # Обновляем platforms, если изменились
                new_platforms = zvonko_release.get('platforms', '')
                old_platforms = release.get('platforms', '')
                if new_platforms and new_platforms != old_platforms:
                    release['platforms'] = new_platforms
                    has_changes = True
                    logger.info(f"🔄 Обновлены площадки: '{old_platforms}' → '{new_platforms}'")
                
                # Обновляем zvonko_data
                if 'zvonko_data' not in release:
                    release['zvonko_data'] = {}
                
                release['zvonko_data'].update({
                    'page': zvonko_release.get('page'),
                    'position_on_page': zvonko_release.get('position_on_page'),
                    'artist': zvonko_release.get('artist'),
                    'label': zvonko_release.get('label'),
                    'territories': zvonko_release.get('territories'),
                    'platforms': zvonko_release.get('platforms'),
                    'genre': zvonko_release.get('genre')
                })
                
                # Если были изменения, обновляем updatedAt
                if has_changes:
                    release['updatedAt'] = datetime.now().isoformat() + "Z"
                    updated_count += 1
                    logger.info(f"✅ Обновлен релиз '{release.get('title', 'N/A')}'")
        except Exception as e:
            logger.error(f"❌ Ошибка при обновлении релиза: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    # Создаем новые релизы
    added_releases = []
    failed_releases = []
    
    for i, zvonko_release in enumerate(new_releases_data):
        try:
            logger.info(f"🎵 Добавление релиза #{i+1}: {zvonko_release.get('title', 'N/A')} - {zvonko_release.get('artist', 'N/A')}")
            
            # Создаем релиз в формате системы
            system_release = create_release_from_zvonko(zvonko_release, users)
            
            if system_release:
                added_releases.append(system_release)
                logger.info(f"✅ Релиз добавлен: {system_release['id']}")
            else:
                failed_releases.append(zvonko_release)
                logger.warning(f"⚠️ Не удалось создать релиз: {zvonko_release.get('title', 'N/A')}")
                
        except Exception as e:
            logger.error(f"❌ Ошибка при добавлении релиза {zvonko_release.get('title', 'N/A')}: {e}")
            failed_releases.append(zvonko_release)
    
    # Обновляем файл релизов (если есть новые релизы или обновления статусов)
    if added_releases or updated_count > 0:
        updated_releases = system_releases + added_releases
        
        # Создаем бэкап
        backup_file = f"/Users/macbook/proga/rossel-music/data/releases_backup_{int(datetime.now().timestamp())}.json"
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(system_releases, f, ensure_ascii=False, indent=2)
        logger.info(f"💾 Бэкап сохранен: {backup_file}")
        
        # Обновляем основной файл
        with open('/Users/macbook/proga/rossel-music/data/releases.json', 'w', encoding='utf-8') as f:
            json.dump(updated_releases, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✅ Обновлен файл releases.json. Добавлено {len(added_releases)} релизов, обновлено статусов: {updated_count}")
    
    # Сохраняем отчет
    report = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total_new': len(new_releases_data),
            'added': len(added_releases),
            'updated': updated_count,
            'failed': len(failed_releases)
        },
        'added_releases': [{'id': r['id'], 'title': r['title'], 'artist': r['zvonko_data']['artist']} for r in added_releases],
        'failed_releases': failed_releases
    }
    
    with open('/Users/macbook/proga/rossel-music/parsers/add_releases_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    logger.info("📄 Отчет сохранен в add_releases_report.json")
    
    # Выводим результаты
    logger.info(f"\n📊 Результаты обработки:")
    logger.info(f"  ✅ Успешно добавлено: {len(added_releases)}")
    logger.info(f"  🔄 Обновлено статусов: {updated_count}")
    logger.info(f"  ❌ Не удалось добавить: {len(failed_releases)}")
    logger.info(f"  📄 Всего релизов в системе: {len(system_releases) + len(added_releases)}")
    
    return len(added_releases) > 0 or updated_count > 0

if __name__ == "__main__":
    success = add_new_releases()
    
    if success:
        print(f"\n🎉 Добавление релизов завершено!")
        print(f"📄 Проверьте add_releases_report.json для детальной информации.")
    else:
        print(f"\n💥 Добавление релизов завершилось с ошибками!")
