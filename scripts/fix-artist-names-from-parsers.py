#!/usr/bin/env python3
"""
Исправление artistName из парсеров (zvonko_data, koala_data)
artistName - это просто текст для отображения, не связан с artistId
"""

import json
from pathlib import Path
from datetime import datetime

def main():
    print('🔧 Заполнение artistName из парсеров (zvonko_data, koala_data)...\n')
    
    script_dir = Path(__file__).parent
    releases_path = script_dir.parent / 'data' / 'releases.json'
    
    with open(releases_path, 'r', encoding='utf-8') as f:
        releases = json.load(f)
    
    print(f'📊 Загружено {len(releases)} релизов\n')
    
    fixed = 0
    already_correct = 0
    no_data = 0
    
    for release in releases:
        changed = False
        artist_name = None
        
        # 1. Пытаемся взять из zvonko_data
        zvonko_data = release.get('zvonko_data', {})
        if zvonko_data and zvonko_data.get('artist'):
            artist_name = zvonko_data.get('artist')
        
        # 2. Если нет zvonko_data, проверяем koala_data или другие источники
        if not artist_name:
            # Можем проверить другие поля, но пока фокус на zvonko_data
            pass
        
        current_artist_name = release.get('artistName', '').strip()
        
        # Если нашли имя артиста из парсера и оно отличается от текущего
        if artist_name and artist_name != current_artist_name:
            release['artistName'] = artist_name
            release['updatedAt'] = datetime.now().isoformat() + 'Z'
            fixed += 1
            changed = True
            if fixed <= 20:
                print(f"   ✅ \"{release.get('title', 'N/A')}\" → {artist_name}")
        elif artist_name and artist_name == current_artist_name:
            already_correct += 1
        elif not artist_name:
            no_data += 1
    
    # Сохраняем
    with open(releases_path, 'w', encoding='utf-8') as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    
    print(f'\n💾 Сохранено\n')
    print(f'📊 Итого:')
    print(f'   ✅ Исправлено: {fixed}')
    print(f'   ✅ Уже было правильно: {already_correct}')
    print(f'   ⚠️  Нет данных в парсерах: {no_data}')
    print(f'\n✨ Готово!')
    print(f'\n📝 Важно:')
    print(f'   - artistName теперь просто текст для отображения')
    print(f'   - artistId может быть пустым или временным')
    print(f'   - Когда артист будет добавлен, релизы подтянутся автоматически')

if __name__ == '__main__':
    main()
