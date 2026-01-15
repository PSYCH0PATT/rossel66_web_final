#!/usr/bin/env python3
"""
Обновление информации об артистах
"""

import json
import uuid
from datetime import datetime

# Данные артистов
artists_data = [
    {
        "artist": "0XR",
        "fio": "Смирнов Даниил Викторович",
        "fio_short": "Смирнов Д. В.",
        "contract": "№ ФЛ/ФЛ-18/09/2025-0XR-ЛД",
        "percentage": 70
    },
    {
        "artist": "передоз",
        "fio": "Дмитриев Константин Сергеевич",
        "fio_short": "Дмитриев К. С.",
        "contract": "№ ФЛ/ФЛ-11/09/2024-передоз-ЛД",
        "percentage": 60
    },
    {
        "artist": "СКАЯ",
        "fio": "Калинская Юлия Иосифовна",
        "fio_short": "Калинская Ю. И.",
        "contract": "№ ФЛ/ИП-06/01/2026-СКАЯ-ЛД",
        "percentage": 60
    },
    {
        "artist": "ЭНТЕNДАNS",
        "fio": "Вознесенский Александр Ильич",
        "fio_short": "Вознесенский А. И.",
        "contract": "На птичьих правах",
        "percentage": 70
    },
    {
        "artist": "ASTRODYA",
        "fio": "Семухин Никита Андреевич",
        "fio_short": "Семухин Н. А.",
        "contract": "№ ФЛ/ФЛ-19/02/2024-ASTRODYA-ЛД",
        "percentage": 60
    },
    {
        "artist": "BORDUN",
        "fio": "Бордун Святослав Александрович",
        "fio_short": "Бордун С. А.",
        "contract": "№ ФЛ/ФЛ-03/04/2025-BORDUN-ЛД",
        "percentage": 60
    },
    {
        "artist": "cherrypiertd",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "Coldn1ght",
        "fio": "Бауэр Игорь Алексеевич",
        "fio_short": "Бауэр И. А.",
        "contract": "№ ФЛ/ФЛ-02/12/2024-Coldn1ght-ЛД",
        "percentage": 60
    },
    {
        "artist": "DayKeys",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "Ego",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "EnellySayk",
        "fio": "Ишутин Александр Владиславович",
        "fio_short": "Ишутин А. В.",
        "contract": "№ ФЛ/ФЛ-18/04/2024-EnellySayk-ЛД",
        "percentage": 60
    },
    {
        "artist": "Etxrnxtx",
        "fio": "Исхаков Руслан Вакильевич",
        "fio_short": "Исхаков Р. В.",
        "contract": "№ ИП/ФЛ-03/09/2024-Etxrnxtx-ЛД",
        "percentage": 60
    },
    {
        "artist": "Jelato",
        "fio": "Котенко Владислав Сергеевич",
        "fio_short": "Котенко В. С.",
        "contract": "№ ФЛ/ФЛ-08/10/2024-Jelato-ЛД",
        "percentage": 60
    },
    {
        "artist": "LINBY",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "LXNOWER",
        "fio": "Мальцев Иван Алексеевич",
        "fio_short": "Мальцев И. А.",
        "contract": "№ ФЛ/ФЛ-02/09/2024-LXNOWER-ЛД",
        "percentage": 60
    },
    {
        "artist": "Makishima",
        "fio": "Чемезов Максим Артемович",
        "fio_short": "Чемезов М. А.",
        "contract": "№ ФЛ/ИП-08/01/2026-Makishima-ЛД",
        "percentage": 65
    },
    {
        "artist": "Matcukito Kioto",
        "fio": "Озеров Александр Владимирович",
        "fio_short": "Озеров А. В.",
        "contract": "№ ФЛ/ФЛ-31/07/2024-Matcukito-Kioto-ЛД",
        "percentage": 60
    },
    {
        "artist": "MEELBRN",
        "fio": "Алтунин Пётр Андреевич",
        "fio_short": "Алтунин П. А.",
        "contract": "№ ФЛ/ФЛ-09/05/2024-MEELBRN-ЛД",
        "percentage": 70
    },
    {
        "artist": "MENDXZA",
        "fio": "Галец Артём Олегович",
        "fio_short": "Галец А. О.",
        "contract": "№ ФЛ/ФЛ-30/12/2023-MENDXZA-ЛД",
        "percentage": 60
    },
    {
        "artist": "Neea",
        "fio": "Орешков Никита Романович",
        "fio_short": "Орешков Н. Р.",
        "contract": "№ ФЛ/ФЛ-21/10/2024-Neea-ЛД",
        "percentage": 60
    },
    {
        "artist": "NENEVESTA",
        "fio": "Григораш Александр Викторович",
        "fio_short": "Григораш А. В.",
        "contract": "№ ФЛ/ФЛ-17/03/2025-NENEVESTA-ЛД",
        "percentage": 70
    },
    {
        "artist": "night moral",
        "fio": "Шаповалов Владимир Александрович",
        "fio_short": "Шаповалов В. А.",
        "contract": "№ ФЛ/ФЛ-16/04/2024-Night-Moral-ЛД",
        "percentage": 60
    },
    {
        "artist": "Nnaia",
        "fio": "Процевич Анастасия Александровна",
        "fio_short": "Процевич А. А.",
        "contract": "№ ФЛ/ФЛ-11/11/2024-Nnaia-ЛД",
        "percentage": 60
    },
    {
        "artist": "PLVT",
        "fio": "Шипицин Платон Алексеевич",
        "fio_short": "Шипицин П. А.",
        "contract": "№ ФЛ/ФЛ-04/03/2024-PLVT-ЛД",
        "percentage": 60
    },
    {
        "artist": "ripznxx",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "Roudie J.",
        "fio": "Литвинов Георгий Андреевич",
        "fio_short": "Литвинов Г. А.",
        "contract": "№ ФЛ/ФЛ-28/05/2024-Roudie-J.-ЛД",
        "percentage": 60
    },
    {
        "artist": "SHWTY",
        "fio": "Гоголев Андрей Дмитриевич",
        "fio_short": "Гоголев А. Д.",
        "contract": "№ ФЛ/ФЛ-06/01/2025-SHWTY-ЛД",
        "percentage": 60
    },
    {
        "artist": "SLAVKESH",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "Sour Diesel",
        "fio": "Резанов Никита Евгеньевич",
        "fio_short": "Резанов Н. Е.",
        "contract": "№ ФЛ/ФЛ-13/37/1488-Sour Diesel-ЛД",
        "percentage": 100
    },
    {
        "artist": "stemstyl",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "Takeda",
        "fio": "Курбанов Шахриёр Шухратбекович",
        "fio_short": "Курбанов Ш. Ш.",
        "contract": "№ ФЛ/ФЛ-03/07/2024-TAKEDA-ЛД",
        "percentage": 60
    },
    {
        "artist": "theflexxboy",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "TXYK",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "VvZz",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "vxlkxv",
        "fio": "-",
        "fio_short": "-",
        "contract": "-",
        "percentage": 0
    },
    {
        "artist": "W.1ce3",
        "fio": "Вишняков Дмитрий Владиславович",
        "fio_short": "Вишняков Д. В.",
        "contract": "№ ФЛ/ФЛ-16/04/2024-W.1ce3-ЛД",
        "percentage": 60
    },
    {
        "artist": "WIDE PIE",
        "fio": "Сидун Иван Викторович",
        "fio_short": "Сидун И. В.",
        "contract": "№ ФЛ/ФЛ-29/08/2024-WIDE-PIE-ЛД",
        "percentage": 75
    },
    {
        "artist": "wvlaik",
        "fio": "Рубцов Владислав Сергеевич",
        "fio_short": "Рубцов В. С.",
        "contract": "На птичьих правах",
        "percentage": 70
    },
    {
        "artist": "yaroshi",
        "fio": "Федосов Андрей Геральдович",
        "fio_short": "Федосов А. Г.",
        "contract": "№ ФЛ/ФЛ-13/06/2025-yaroshi-ЛД",
        "percentage": 60
    },
    {
        "artist": "ZIND",
        "fio": "Китаев Максим Анатольевич",
        "fio_short": "Китаев М. А.",
        "contract": "№ ФЛ/ФЛ-25/03/2024-ZIND-ЛД",
        "percentage": 60
    },
    {
        "artist": "sadaround",
        "fio": "Базилевич Андрей Игоревич",
        "fio_short": "Базилевич А. И.",
        "contract": "№ ФЛ/ИП-05/12/2025-sadaround-ЛД",
        "percentage": 70
    }
]

def update_artists():
    """Обновляет информацию об артистах"""
    
    # Загружаем пользователей
    with open('data/users.json', 'r', encoding='utf-8') as f:
        users = json.load(f)
    
    # Создаем бэкап
    backup_file = f"data/users_backup_{int(datetime.now().timestamp())}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    print(f"💾 Бэкап сохранен: {backup_file}")
    
    # Создаем словарь существующих артистов
    existing_artists = {}
    for user in users:
        if user.get('role') == 'artist':
            existing_artists[user['name']] = user
    
    updated_count = 0
    created_count = 0
    
    for artist_info in artists_data:
        artist_name = artist_info['artist']
        
        if artist_name in existing_artists:
            # Обновляем существующего артиста
            artist = existing_artists[artist_name]
            artist['fio'] = artist_info['fio']
            artist['fioShort'] = artist_info['fio_short']
            artist['contract'] = artist_info['contract']
            artist['percentage'] = artist_info['percentage']
            artist['updatedAt'] = datetime.now().isoformat()
            updated_count += 1
            print(f"🔄 Обновлен артист: {artist_name}")
        else:
            # Создаем нового артиста
            new_artist = {
                "id": str(uuid.uuid4()),
                "username": artist_name.lower().replace(' ', '').replace('.', ''),
                "password": artist_name.lower().replace(' ', '') + "1234",
                "role": "artist",
                "name": artist_name,
                "fio": artist_info['fio'],
                "fioShort": artist_info['fio_short'],
                "contract": artist_info['contract'],
                "percentage": artist_info['percentage'],
                "createdAt": datetime.now().isoformat(),
                "updatedAt": datetime.now().isoformat()
            }
            users.append(new_artist)
            created_count += 1
            print(f"✅ Создан артист: {artist_name}")
    
    # Сохраняем результат
    with open('data/users.json', 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    
    print(f"""
🎉 Обновление артистов завершено!
📊 Статистика:
  🔄 Обновлено: {updated_count}
  ✅ Создано: {created_count}
  📁 Всего артистов: {len([u for u in users if u.get('role') == 'artist'])}
""")

if __name__ == "__main__":
    update_artists()
