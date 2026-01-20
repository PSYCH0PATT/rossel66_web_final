#!/usr/bin/env python3
"""
Заполнение artistName из users.json по artistId
"""

import json
from pathlib import Path
from datetime import datetime

def main():
    print('🔧 Заполнение artistName для релизов...\n')
    
    script_dir = Path(__file__).parent
    releases_path = script_dir.parent / 'data' / 'releases.json'
    users_path = script_dir.parent / 'data' / 'users.json'
    
    with open(releases_path, 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    with open(users_path, 'r', encoding='utf-8') as f:
        users = json.load(f)
    
    # Создаем словарь user_id -> (name, username)
    users_dict = {}
    for user in users:
        if user.get('role') == 'artist':
            users_dict[user['id']] = (user.get('name', ''), user.get('username', ''))
    
    print(f'📊 Загружено {len(releases)} релизов и {len(users_dict)} артистов\n')
    
    fixed = 0
    not_found = 0
    
    for release in releases:
        artist_id = release.get('artistId', '')
        artist_name = release.get('artistName', '')
        
        # Если artistId есть, но artistName отсутствует или пустой
        if artist_id and (not artist_name or artist_name.strip() == ''):
            if artist_id in users_dict:
                name, username = users_dict[artist_id]
                release['artistName'] = name or username
                release['updatedAt'] = datetime.now().isoformat() + 'Z'
                fixed += 1
            else:
                not_found += 1
                print(f"   ⚠️  Артист с ID {artist_id} не найден для релиза \"{release.get('title', 'N/A')}\"")
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 Сохранено\n')
    print(f'📊 Итого:')
    print(f'   ✅ artistName заполнено: {fixed}')
    print(f'   ⚠️  Артистов не найдено: {not_found}')
    print(f'\n✨ Готово!')

if __name__ == '__main__':
    main()
