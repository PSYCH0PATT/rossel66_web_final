#!/usr/bin/env python3
"""
Полное исправление релизов:
1. Удаление статуса "Новый" (замена на "Модерируется")
2. Исправление неправильных артистов
"""

import json
import os
from pathlib import Path

def normalize_status(status):
    if not status:
        return 'Модерируется'
    
    status_lower = status.lower().strip()
    
    status_map = {
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
    }
    
    return status_map.get(status_lower, 'Модерируется')

def normalize_artist_name(name):
    if not name:
        return ''
    import re
    return re.sub(r'[^\w\s]', '', name.lower().strip().replace('  ', ' '))

def find_artist_by_name(artist_name, users):
    normalized_search = normalize_artist_name(artist_name)
    
    for user in users:
        if user.get('role') != 'artist':
            continue
        
        normalized_name = normalize_artist_name(user.get('name', ''))
        normalized_username = normalize_artist_name(user.get('username', ''))
        
        if normalized_name == normalized_search or normalized_username == normalized_search:
            return user
    
    return None

def main():
    print('🔧 Исправление релизов...\n')
    
    # Загружаем данные
    script_dir = Path(__file__).parent
    releases_path = script_dir.parent / 'data' / 'releases.json'
    users_path = script_dir.parent / 'data' / 'users.json'
    
    with open(releases_path, 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    with open(users_path, 'r', encoding='utf-8') as f:
        users = json.load(f)
    
    print(f'📊 Загружено {len(releases)} релизов и {len(users)} пользователей\n')
    
    status_fixed = 0
    artist_fixed = 0
    artist_not_found = 0
    artist_problems = []
    
    import re
    from datetime import datetime
    
    for release in releases:
        changed = False
        
        # 1. Исправляем статус "Новый"
        if release.get('status') == 'Новый' or release.get('status') == 'новый':
            release['status'] = normalize_status(release.get('status'))
            status_fixed += 1
            changed = True
        
        # 2. Исправляем артистов
        artist_id = release.get('artistId', '')
        artist_name = release.get('artistName', '')
        
        # Проверяем, является ли artistId временным
        is_temporary = bool(re.match(r'^(user_|artist_)?\d+$', str(artist_id))) or artist_id == '25' or artist_id == 'skaya'
        
        if is_temporary or not artist_id or artist_id == 'skaya':
            # Пытаемся найти артиста
            search_name = artist_name
            
            # Если нет имени, пытаемся извлечь из названия
            if not search_name and release.get('title'):
                title_parts = release.get('title', '').split(' - ')
                if title_parts:
                    search_name = title_parts[0].strip()
            
            if search_name:
                found_artist = find_artist_by_name(search_name, users)
                if found_artist:
                    release['artistId'] = found_artist['id']
                    release['artistName'] = found_artist.get('name') or found_artist.get('username', '')
                    artist_fixed += 1
                    changed = True
                else:
                    artist_not_found += 1
                    artist_problems.append({
                        'title': release.get('title', 'N/A'),
                        'artistName': search_name,
                        'oldId': artist_id
                    })
            else:
                artist_not_found += 1
                artist_problems.append({
                    'title': release.get('title', 'N/A'),
                    'artistName': 'не указан',
                    'oldId': artist_id
                })
        
        # Обновляем updatedAt
        if changed:
            release['updatedAt'] = datetime.now().isoformat() + 'Z'
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print('💾 Сохранено\n')
    print('📊 Итого:')
    print(f'   ✅ Статусов исправлено: {status_fixed}')
    print(f'   ✅ Артистов исправлено: {artist_fixed}')
    print(f'   ⚠️  Артистов не найдено: {artist_not_found}')
    
    if artist_problems and len(artist_problems) <= 20:
        print('\n⚠️  Релизы без найденных артистов (первые 10):')
        for p in artist_problems[:10]:
            print(f'   - "{p["title"]}" (артист: {p["artistName"]}, старый ID: {p["oldId"]})')
        if len(artist_problems) > 10:
            print(f'   ... и еще {len(artist_problems) - 10}')
    
    print('\n✨ Готово!')

if __name__ == '__main__':
    main()
