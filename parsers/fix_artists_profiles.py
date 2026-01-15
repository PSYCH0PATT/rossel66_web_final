#!/usr/bin/env python3
"""
Исправление профилей артистов - пароли и поля
"""

import json
import random
from datetime import datetime

def generate_password():
    """Генерирует случайный 4-значный пароль"""
    return str(random.randint(1000, 9999))

def fix_artists():
    """Исправляет профили артистов"""
    
    # Загружаем пользователей
    with open('data/users.json', 'r', encoding='utf-8') as f:
        users = json.load(f)
    
    # Создаем бэкап
    backup_file = f"data/users_backup_{int(datetime.now().timestamp())}.json"
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    print(f"💾 Бэкап сохранен: {backup_file}")
    
    # Данные артистов для обновления
    artists_data = {
        "0XR": {
            "fio": "Смирнов Даниил Викторович",
            "fioShort": "Смирнов Д. В.",
            "contract": "№ ФЛ/ФЛ-18/09/2025-0XR-ЛД",
            "percentage": 70
        },
        "передоз": {
            "fio": "Дмитриев Константин Сергеевич",
            "fioShort": "Дмитриев К. С.",
            "contract": "№ ФЛ/ФЛ-11/09/2024-передоз-ЛД",
            "percentage": 60
        },
        "СКАЯ": {
            "fio": "Калинская Юлия Иосифовна",
            "fioShort": "Калинская Ю. И.",
            "contract": "№ ФЛ/ИП-06/01/2026-СКАЯ-ЛД",
            "percentage": 60
        },
        "ЭНТЕNДАNS": {
            "fio": "Вознесенский Александр Ильич",
            "fioShort": "Вознесенский А. И.",
            "contract": "На птичьих правах",
            "percentage": 70
        },
        "ASTRODYA": {
            "fio": "Семухин Никита Андреевич",
            "fioShort": "Семухин Н. А.",
            "contract": "№ ФЛ/ФЛ-19/02/2024-ASTRODYA-ЛД",
            "percentage": 60
        },
        "BORDUN": {
            "fio": "Бордун Святослав Александрович",
            "fioShort": "Бордун С. А.",
            "contract": "№ ФЛ/ФЛ-03/04/2025-BORDUN-ЛД",
            "percentage": 60
        },
        "cherrypiertd": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "Coldn1ght": {
            "fio": "Бауэр Игорь Алексеевич",
            "fioShort": "Бауэр И. А.",
            "contract": "№ ФЛ/ФЛ-02/12/2024-Coldn1ght-ЛД",
            "percentage": 60
        },
        "DayKeys": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "Ego": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "EnellySayk": {
            "fio": "Ишутин Александр Владиславович",
            "fioShort": "Ишутин А. В.",
            "contract": "№ ФЛ/ФЛ-18/04/2024-EnellySayk-ЛД",
            "percentage": 60
        },
        "Etxrnxtx": {
            "fio": "Исхаков Руслан Вакильевич",
            "fioShort": "Исхаков Р. В.",
            "contract": "№ ИП/ФЛ-03/09/2024-Etxrnxtx-ЛД",
            "percentage": 60
        },
        "Jelato": {
            "fio": "Котенко Владислав Сергеевич",
            "fioShort": "Котенко В. С.",
            "contract": "№ ФЛ/ФЛ-08/10/2024-Jelato-ЛД",
            "percentage": 60
        },
        "LINBY": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "LXNOWER": {
            "fio": "Мальцев Иван Алексеевич",
            "fioShort": "Мальцев И. А.",
            "contract": "№ ФЛ/ФЛ-02/09/2024-LXNOWER-ЛД",
            "percentage": 60
        },
        "Makishima": {
            "fio": "Чемезов Максим Артемович",
            "fioShort": "Чемезов М. А.",
            "contract": "№ ФЛ/ИП-08/01/2026-Makishima-ЛД",
            "percentage": 65
        },
        "Matcukito Kioto": {
            "fio": "Озеров Александр Владимирович",
            "fioShort": "Озеров А. В.",
            "contract": "№ ФЛ/ФЛ-31/07/2024-Matcukito-Kioto-ЛД",
            "percentage": 60
        },
        "MEELBRN": {
            "fio": "Алтунин Пётр Андреевич",
            "fioShort": "Алтунин П. А.",
            "contract": "№ ФЛ/ФЛ-09/05/2024-MEELBRN-ЛД",
            "percentage": 70
        },
        "MENDXZA": {
            "fio": "Галец Артём Олегович",
            "fioShort": "Галец А. О.",
            "contract": "№ ФЛ/ФЛ-30/12/2023-MENDXZA-ЛД",
            "percentage": 60
        },
        "Neea": {
            "fio": "Орешков Никита Романович",
            "fioShort": "Орешков Н. Р.",
            "contract": "№ ФЛ/ФЛ-21/10/2024-Neea-ЛД",
            "percentage": 60
        },
        "NENEVESTA": {
            "fio": "Григораш Александр Викторович",
            "fioShort": "Григораш А. В.",
            "contract": "№ ФЛ/ФЛ-17/03/2025-NENEVESTA-ЛД",
            "percentage": 70
        },
        "night moral": {
            "fio": "Шаповалов Владимир Александрович",
            "fioShort": "Шаповалов В. А.",
            "contract": "№ ФЛ/ФЛ-16/04/2024-Night-Moral-ЛД",
            "percentage": 60
        },
        "Nnaia": {
            "fio": "Процевич Анастасия Александровна",
            "fioShort": "Процевич А. А.",
            "contract": "№ ФЛ/ФЛ-11/11/2024-Nnaia-ЛД",
            "percentage": 60
        },
        "PLVT": {
            "fio": "Шипицин Платон Алексеевич",
            "fioShort": "Шипицин П. А.",
            "contract": "№ ФЛ/ФЛ-04/03/2024-PLVT-ЛД",
            "percentage": 60
        },
        "ripznxx": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "Roudie J.": {
            "fio": "Литвинов Георгий Андреевич",
            "fioShort": "Литвинов Г. А.",
            "contract": "№ ФЛ/ФЛ-28/05/2024-Roudie-J.-ЛД",
            "percentage": 60
        },
        "SHWTY": {
            "fio": "Гоголев Андрей Дмитриевич",
            "fioShort": "Гоголев А. Д.",
            "contract": "№ ФЛ/ФЛ-06/01/2025-SHWTY-ЛД",
            "percentage": 60
        },
        "SLAVKESH": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "Sour Diesel": {
            "fio": "Резанов Никита Евгеньевич",
            "fioShort": "Резанов Н. Е.",
            "contract": "№ ФЛ/ФЛ-13/37/1488-Sour Diesel-ЛД",
            "percentage": 100
        },
        "stemstyl": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "Takeda": {
            "fio": "Курбанов Шахриёр Шухратбекович",
            "fioShort": "Курбанов Ш. Ш.",
            "contract": "№ ФЛ/ФЛ-03/07/2024-TAKEDA-ЛД",
            "percentage": 60
        },
        "theflexxboy": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "TXYK": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "VvZz": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "vxlkxv": {
            "fio": "-",
            "fioShort": "-",
            "contract": "-",
            "percentage": 0
        },
        "W.1ce3": {
            "fio": "Вишняков Дмитрий Владиславович",
            "fioShort": "Вишняков Д. В.",
            "contract": "№ ФЛ/ФЛ-16/04/2024-W.1ce3-ЛД",
            "percentage": 60
        },
        "WIDE PIE": {
            "fio": "Сидун Иван Викторович",
            "fioShort": "Сидун И. В.",
            "contract": "№ ФЛ/ФЛ-29/08/2024-WIDE-PIE-ЛД",
            "percentage": 75
        },
        "wvlaik": {
            "fio": "Рубцов Владислав Сергеевич",
            "fioShort": "Рубцов В. С.",
            "contract": "На птичьих правах",
            "percentage": 70
        },
        "yaroshi": {
            "fio": "Федосов Андрей Геральдович",
            "fioShort": "Федосов А. Г.",
            "contract": "№ ФЛ/ФЛ-13/06/2025-yaroshi-ЛД",
            "percentage": 60
        },
        "ZIND": {
            "fio": "Китаев Максим Анатольевич",
            "fioShort": "Китаев М. А.",
            "contract": "№ ФЛ/ФЛ-25/03/2024-ZIND-ЛД",
            "percentage": 60
        },
        "sadaround": {
            "fio": "Базилевич Андрей Игоревич",
            "fioShort": "Базилевич А. И.",
            "contract": "№ ФЛ/ИП-05/12/2025-sadaround-ЛД",
            "percentage": 70
        }
    }
    
    # Находим и удаляем дубликаты ЭНТЕNДАNS
    entendans_users = [u for u in users if u.get('name') == 'ЭНТЕNДАNS' and u.get('role') == 'artist']
    if len(entendans_users) > 1:
        # Оставляем первого, удаляем остальных
        keep_user = entendans_users[0]
        users = [u for u in users if not (u.get('name') == 'ЭНТЕNДАNS' and u.get('role') == 'artist' and u['id'] != keep_user['id'])]
        print(f"🗑️  Удален дубликат артиста: ЭНТЕNДАNS")
    
    # Обновляем всех артистов
    updated_count = 0
    for user in users:
        if user.get('role') == 'artist':
            artist_name = user.get('name')
            
            if artist_name in artists_data:
                artist_info = artists_data[artist_name]
                
                # Обновляем пароль (рандомные 4 цифры после ID)
                user_id = user.get('id', '')
                new_password = user_id[-4:] if len(user_id) >= 4 else generate_password()
                user['password'] = new_password
                
                # Добавляем/обновляем поля
                user['fio'] = artist_info['fio']
                user['fioShort'] = artist_info['fioShort']
                user['contract'] = artist_info['contract']
                user['percentage'] = artist_info['percentage']
                user['updatedAt'] = datetime.now().isoformat()
                
                updated_count += 1
                print(f"🔄 Обновлен артист: {artist_name} (пароль: {new_password})")
    
    # Сохраняем результат
    with open('data/users.json', 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    
    print(f"""
🎉 Профили артистов исправлены!
📊 Статистика:
  🔄 Обновлено: {updated_count}
  📁 Всего артистов: {len([u for u in users if u.get('role') == 'artist'])}
""")

if __name__ == "__main__":
    fix_artists()
