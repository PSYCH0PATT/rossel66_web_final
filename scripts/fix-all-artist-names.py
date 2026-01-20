#!/usr/bin/env python3
"""
Заполнение artistName из zvonko_data для всех релизов
Даже если артист не зарегистрирован в системе
"""

import json
from pathlib import Path
from datetime import datetime

def main():
    print('🔧 Заполнение artistName из zvonko_data для всех релизов...\n')
    
    script_dir = Path(__file__).parent
    releases_path = script_dir.parent / 'data' / 'releases.json'
    
    with open(releases_path, 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    print(f'📊 Загружено {len(releases)} релизов\n')
    
    fixed = 0
    already_correct = 0
    
    for release in releases:
        changed = False
        
        # Получаем имя артиста из zvonko_data
        zvonko_data = release.get('zvonko_data', {})
        zvonko_artist = zvonko_data.get('artist', '') if zvonko_data else ''
        
        current_artist_name = release.get('artistName', '').strip()
        
        # Если есть артист в zvonko_data и он отличается от текущего
        if zvonko_artist and zvonko_artist != current_artist_name:
            release['artistName'] = zvonko_artist
            release['updatedAt'] = datetime.now().isoformat() + 'Z'
            fixed += 1
            changed = True
            if fixed <= 20:  # Показываем первые 20
                print(f"   ✅ \"{release.get('title', 'N/A')}\" → {zvonko_artist}")
        elif zvonko_artist and zvonko_artist == current_artist_name:
            already_correct += 1
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 Сохранено\n')
    print(f'📊 Итого:')
    print(f'   ✅ Исправлено: {fixed}')
    print(f'   ✅ Уже было правильно: {already_correct}')
    print(f'\n✨ Готово!')

if __name__ == '__main__':
    main()
