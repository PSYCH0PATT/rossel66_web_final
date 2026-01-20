#!/usr/bin/env python3
"""
Сопоставление артистов по никнеймам из artistName с артистами в БД
Если артист не найден - оставляем artistId как есть (не меняем)
"""

import json
import re
from pathlib import Path
from datetime import datetime

def normalize_artist_name(name):
    """Нормализует имя артиста для сравнения"""
    if not name:
        return ''
    # Убираем спецсимволы, приводим к нижнему регистру, убираем лишние пробелы
    return re.sub(r'[^\w\s]', '', name.lower().strip().replace('  ', ' '))

def find_artist_by_name(artist_name, users):
    """Находит артиста по точному совпадению name или username"""
    if not artist_name:
        return None
    
    normalized_search = normalize_artist_name(artist_name)
    
    for user in users:
        if user.get('role') != 'artist':
            continue
        
        normalized_name = normalize_artist_name(user.get('name', ''))
        normalized_username = normalize_artist_name(user.get('username', ''))
        
        # Только точное совпадение
        if normalized_name == normalized_search or normalized_username == normalized_search:
            return user
    
    return None

def main():
    print('🔧 Сопоставление артистов по никнеймам...\n')
    
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
    already_correct = 0
    
    for release in releases:
        artist_name = release.get('artistName', '').strip()
        current_artist_id = release.get('artistId')
        
        # Если нет artistName - пропускаем
        if not artist_name:
            continue
        
        # Если artistName содержит несколько артистов (через запятую), берем первого
        # Например: "MEELBRN, BITSA MANIAC" -> "MEELBRN"
        main_artist_name = artist_name.split(',')[0].strip()
        
        # Ищем артиста в БД
        found_artist = find_artist_by_name(main_artist_name, users)
        
        if found_artist:
            # Если найден и artistId отличается - обновляем
            if current_artist_id != found_artist['id']:
                release['artistId'] = found_artist['id']
                release['updatedAt'] = datetime.now().isoformat() + 'Z'
                fixed += 1
                if fixed <= 20:
                    print(f"   ✅ \"{release.get('title', 'N/A')}\" | {artist_name} → {found_artist.get('name') or found_artist.get('username')} ({found_artist['id']})")
            else:
                already_correct += 1
        else:
            # Артист не найден - оставляем как есть (не меняем)
            not_found += 1
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 Сохранено\n')
    print(f'📊 Итого:')
    print(f'   ✅ Сопоставлено и обновлено: {fixed}')
    print(f'   ✅ Уже было правильно: {already_correct}')
    print(f'   ⚠️  Артисты не найдены (оставлены без изменений): {not_found}')
    print(f'\n✨ Готово!')

if __name__ == '__main__':
    main()
