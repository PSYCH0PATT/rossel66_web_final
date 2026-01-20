#!/usr/bin/env python3
"""
Исправление релизов с неправильным artistId = '25' (СКАЯ)
Используем данные из zvonko_data для поиска правильных артистов
"""

import json
import re
from pathlib import Path
from datetime import datetime

def normalize_artist_name(name):
    if not name:
        return ''
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
    print('🔧 Исправление релизов с неправильным артистом СКАЯ...\n')
    
    script_dir = Path(__file__).parent
    releases_path = script_dir.parent / 'data' / 'releases.json'
    users_path = script_dir.parent / 'data' / 'users.json'
    
    with open(releases_path, 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    with open(users_path, 'r', encoding='utf-8') as f:
        users = json.load(f)
    
    print(f'📊 Загружено {len(releases)} релизов и {len(users)} пользователей\n')
    
    fixed = 0
    not_found = 0
    problems = []
    
    for release in releases:
        # Проверяем только релизы с artistId = '25' (СКАЯ)
        if release.get('artistId') != '25':
            continue
        
        # Пытаемся найти правильного артиста
        artist_name = None
        
        # 1. Из zvonko_data
        zvonko_data = release.get('zvonko_data', {})
        if zvonko_data and zvonko_data.get('artist'):
            artist_name = zvonko_data.get('artist')
        
        # 2. Из artistName (если есть)
        if not artist_name and release.get('artistName'):
            artist_name = release.get('artistName')
        
        # 3. Из названия релиза (попытка извлечь)
        if not artist_name and release.get('title'):
            # Пытаемся извлечь из формата "Artist - Title" или "Title (feat. Artist)"
            title = release.get('title', '')
            parts = title.split(' - ')
            if len(parts) > 1:
                artist_name = parts[0].strip()
            else:
                # Ищем в скобках
                match = re.search(r'\((?:feat\.|ft\.|prod\.by)\s+([^)]+)\)', title, re.IGNORECASE)
                if match:
                    artist_name = match.group(1).strip()
        
        if artist_name:
            found_artist = find_artist_by_name(artist_name, users)
            if found_artist:
                release['artistId'] = found_artist['id']
                release['artistName'] = found_artist.get('name') or found_artist.get('username', '')
                release['updatedAt'] = datetime.now().isoformat() + 'Z'
                fixed += 1
                print(f"   ✅ \"{release.get('title', 'N/A')}\" → {release['artistName']}")
            else:
                not_found += 1
                problems.append({
                    'title': release.get('title', 'N/A'),
                    'artist': artist_name
                })
        else:
            not_found += 1
            problems.append({
                'title': release.get('title', 'N/A'),
                'artist': 'не найден'
            })
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 Сохранено\n')
    print(f'📊 Итого:')
    print(f'   ✅ Исправлено: {fixed}')
    print(f'   ⚠️  Не найдено: {not_found}')
    
    if problems and len(problems) <= 20:
        print(f'\n⚠️  Релизы без найденных артистов (первые 10):')
        for p in problems[:10]:
            print(f'   - "{p["title"]}" (артист: {p["artist"]})')
        if len(problems) > 10:
            print(f'   ... и еще {len(problems) - 10}')
    
    print(f'\n✨ Готово!')

if __name__ == '__main__':
    main()
