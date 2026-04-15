import pandas as pd
from openpyxl import load_workbook
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string
import shutil
import os
import re
import json
import sys
import time
from collections import defaultdict

# Путь к шаблону (копируем из оригинального проекта)
TEMPLATE_PATH = "Отчёт MENDXZA.xlsx"

# Пути к Excel файлам вместо Google Sheets (ТОЧНО как в MAIN_MAY.py)
ARTISTS_EXCEL_PATH = "artists.xlsx"  # Файл со списком артистов
ROYALTY_SHARES_EXCEL_PATH = "royalty_shares.xlsx"  # Файл с долями артистов

# Ожидаемые колонки отчёта и возможные варианты названий в Excel
COLUMN_ALIASES = {
    'Код': ['Код', 'код', 'Код трека'],
    'Исполнитель': ['Исполнитель', 'исполнитель', 'Artist'],
    'Наименование': ['Наименование', 'наименование', 'Название', 'Трек'],
    'Альбом': ['Альбом', 'альбом', 'Release'],
    'Количество': ['Количество', 'количество', 'Кол-во', 'Прослушивания'],
    'Сумма, руб.': ['Сумма, руб.', 'Сумма,руб.', 'Сумма (руб.)', 'Сумма руб.', 'Сумма руб', 'Сумма, руб', 'Сумма', 'сумма, руб.', 'Сумма (руб)'],
}

def _set_cell(ws, cell_ref, value):
    """Записывает значение в ячейку; если ячейка объединена — в левую верхнюю ячейку диапазона."""
    try:
        cell = ws[cell_ref]
        if type(cell).__name__ == 'MergedCell':
            col_letter, row = coordinate_from_string(cell_ref)
            col = column_index_from_string(col_letter)
            for mr in ws.merged_cells.ranges:
                if mr.min_row <= row <= mr.max_row and mr.min_col <= col <= mr.max_col:
                    ws.cell(row=mr.min_row, column=mr.min_col).value = value
                    return
        cell.value = value
    except AttributeError:
        col_letter, row = coordinate_from_string(cell_ref)
        col = column_index_from_string(col_letter)
        for mr in ws.merged_cells.ranges:
            if mr.min_row <= row <= mr.max_row and mr.min_col <= col <= mr.max_col:
                ws.cell(row=mr.min_row, column=mr.min_col).value = value
                return
        raise

def _normalize_statement_columns(df):
    """Приводит названия колонок к ожидаемым (разные форматы выгрузки)."""
    rename = {}
    for col in df.columns:
        c = str(col).strip() if pd.notna(col) else ''
        for canonical, aliases in COLUMN_ALIASES.items():
            if c in aliases or c == canonical:
                rename[col] = canonical
                break
    return df.rename(columns=rename)

def get_artists_list_from_users():
    """Читает данные артистов из users.json. Один канонический ключ на артиста (name или username), чтобы не дублировать отчёты."""
    try:
        users_file = 'data/users.json'
        if not os.path.exists(users_file):
            print("Файл users.json не найден")
            return {}, []
        
        with open(users_file, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
        
        artists_dict = {}
        match_list = []  # (canonical_key, [name, username, ...]) для сопоставления по строке исполнителя
        for user in users_data:
            if user.get('role') != 'artist':
                continue
            canonical = user.get('name') or user.get('username')
            if not canonical:
                continue
            percentage = user.get('percentage')
            if percentage is None or percentage == '':
                print(f"⚠️  Пропущен артист {canonical}: не указан процент")
                continue
            
            artists_dict[canonical] = [
                user.get('fio') or user.get('name') or '',
                user.get('fioShort') or user.get('name') or '',
                user.get('contract') or '',
                str(user.get('percentage', 50))
            ]
            aliases = [a for a in (user.get('name'), user.get('username')) if a]
            match_list.append((canonical, aliases))
        
        print(f"✅ Загружено {len(artists_dict)} артистов из users.json")
        return artists_dict, match_list
    except Exception as e:
        print(f"Ошибка при чтении users.json: {e}")
        return {}, []

def get_royalty_shares():
    # Возвращаем пустой словарь (как в оригинале)
    return {}

def get_royalty_shares_from_file(file_path):
    """Читает доли роялти из переданного файла"""
    try:
        df = pd.read_excel(file_path)
        shares = {}
        for _, row in df.iloc[1:].iterrows():
            if pd.notna(row[0]):
                track_code = str(row[0])
                performer = str(row[3]) if pd.notna(row[3]) else None
                percent = row[4] if pd.notna(row[4]) else None
                if track_code and performer and percent:
                    if track_code not in shares:
                        shares[track_code] = {}
                    try:
                        percent_str = str(percent)
                        percent_value = float(percent_str.replace('%', '')) / 100
                        shares[track_code][performer] = percent_value
                    except (ValueError, TypeError):
                        continue
        return shares
    except Exception as e:
        print(f"Ошибка при чтении файла долей: {e}")
        return {}

def extract_artists_from_track(artist_str, match_list):
    """Извлекает список артистов из строки исполнителя. Возвращает только канонические имена (без дубликатов по регистру)."""
    if not isinstance(artist_str, str):
        artist_str = str(artist_str)
    found = []
    for canonical, aliases in match_list:
        for alias in aliases:
            if alias and re.search(re.escape(alias), artist_str, re.IGNORECASE):
                found.append(canonical)
                break
    return found

def get_royalty_shares_from_tracks():
    """Загружает доли роялти из треков в releases.json"""
    try:
        releases_file = 'data/releases.json'
        if not os.path.exists(releases_file):
            return {}
        
        with open(releases_file, 'r', encoding='utf-8') as f:
            releases_data = json.load(f)
        
        track_shares = {}
        for release in releases_data:
            if not release.get('tracks'):
                continue
            
            for track in release.get('tracks', []):
                isrc = track.get('isrc')
                royalty_shares = track.get('royaltyShares')
                
                if isrc and royalty_shares and isinstance(royalty_shares, dict):
                    # Конвертируем проценты в доли (0-1)
                    if isrc not in track_shares:
                        track_shares[isrc] = {}
                    for artist_name, percentage in royalty_shares.items():
                        if percentage is not None and percentage > 0:
                            try:
                                track_shares[isrc][artist_name] = float(percentage) / 100.0
                            except (ValueError, TypeError):
                                continue
        
        if track_shares:
            print(f"✅ Загружено {len(track_shares)} треков с долями роялти из releases.json")
        return track_shares
    except Exception as e:
        print(f"Ошибка при чтении долей из треков: {e}")
        return {}

def calculate_artist_share(track_code, artist, all_artists_in_track, artists_data, royalty_shares, track_royalty_shares=None):
    """Рассчитывает долю артиста в треке"""
    # 1. Если артист один в треке - получает 100%
    if len(all_artists_in_track) == 1:
        return 1.0
    
    # 2. ВЫСШИЙ ПРИОРИТЕТ: Доли из треков (releases.json)
    if track_royalty_shares and track_code in track_royalty_shares:
        track_shares = track_royalty_shares[track_code]
        if artist in track_shares:
            return track_shares[artist]
    
    # 3. ПРИОРИТЕТ: Проверяем файл "Доли роялти" (точные доли для конкретного трека)
    if track_code in royalty_shares:
        track_shares = royalty_shares[track_code]
        if artist in track_shares:
            return track_shares[artist]
    
    # 4. Если все артисты в треке зарегистрированы - делим поровну
    if all(a in artists_data for a in all_artists_in_track):
        return 1.0 / len(all_artists_in_track)
    
    # 5. Считаем только наших артистов (из artists_data)
    our_artists_count = sum(1 for a in all_artists_in_track if a in artists_data)
    if our_artists_count > 0:
        return 1.0 / our_artists_count
    
    # 6. Если артист не найден - получает 0%
    return 0.0

def process_file(statement_path, quarter, year, royalty_file_path=None):
    """Обработка файла с единым хранилищем отчетов"""
    # Создаем единую папку для всех отчетов
    reports_dir = f'data/reports/{quarter}'
    os.makedirs(reports_dir, exist_ok=True)
    
    # Загружаем список пользователей для проверки регистрации
    users_file = 'data/users.json'
    registered_users = set()
    if os.path.exists(users_file):
        with open(users_file, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
            registered_users = {user.get('username') for user in users_data if user.get('username')}
            # Также добавляем name как зарегистрированных
            for user in users_data:
                if user.get('name'):
                    registered_users.add(user.get('name'))
    
    # Лист с данными: по умолчанию TDSheet, если нет — первый лист
    xl = pd.ExcelFile(statement_path)
    sheet_name = 'TDSheet' if 'TDSheet' in xl.sheet_names else xl.sheet_names[0]
    statement_df = pd.read_excel(statement_path, sheet_name=sheet_name)
    statement_df = _normalize_statement_columns(statement_df)

    required = ['Код', 'Исполнитель', 'Наименование', 'Альбом', 'Количество', 'Сумма, руб.']
    missing = [c for c in required if c not in statement_df.columns]
    if missing:
        raise ValueError(
            f"В файле отчёта не найдены колонки: {missing}. "
            f"Есть колонки: {list(statement_df.columns)}"
        )

    # Загружаем данные артистов из users.json (один канонический ключ на артиста)
    artists_data, match_list = get_artists_list_from_users()
    
    if not artists_data:
        print("⚠️  Не найдено артистов с указанным процентом в users.json")
        return []
        
    # Загружаем доли роялти из треков (высший приоритет)
    track_royalty_shares = get_royalty_shares_from_tracks()
    
    # Загружаем доли роялти из файла (если передан) - используется как fallback
    if royalty_file_path and os.path.exists(royalty_file_path):
        royalty_shares = get_royalty_shares_from_file(royalty_file_path)
    else:
        royalty_shares = get_royalty_shares()
    
    artists_tracks = defaultdict(lambda: defaultdict(lambda: {'Количество': 0, 'Сумма, руб.': 0, 'Доля': 0}))
    for _, row in statement_df.iterrows():
        track_code = row['Код']
        artist_str = row['Исполнитель']
        track_artists = extract_artists_from_track(artist_str, match_list)
        if not track_artists:
            continue
        for artist in track_artists:
            share = calculate_artist_share(track_code, artist, track_artists, artists_data, royalty_shares, track_royalty_shares)
            amount_share = row['Сумма, руб.'] * share
            track_key = (track_code, row['Исполнитель'], row['Наименование'], row['Альбом'])
            artists_tracks[artist][track_key]['Количество'] += row['Количество']
            artists_tracks[artist][track_key]['Сумма, руб.'] += amount_share
            artists_tracks[artist][track_key]['Доля'] = share * 100

    created_files = []
    reports_metadata = []
    
    for artist, tracks in artists_tracks.items():
        # Пропускаем артистов, которых нет в artists_data (без percentage)
        if artist not in artists_data:
            print(f"⚠️  Пропущен артист {artist}: не найден в списке артистов с процентом")
            continue
        
        # Все файлы сохраняем в единую папку
        artist_file_path = os.path.join(reports_dir, f'{artist}.xlsx')
        is_registered = artist in registered_users
        
        print(f"Создаем отчет для {'зарегистрированного' if is_registered else 'незарегистрированного'} артиста: {artist}")
        
        shutil.copy(TEMPLATE_PATH, artist_file_path)
        wb = load_workbook(artist_file_path)
        # Лист сводки: в шаблоне может быть "Итог" или "Краткая сводка"
        summary_sheet_name = 'Итог' if 'Итог' in wb.sheetnames else ('Краткая сводка' if 'Краткая сводка' in wb.sheetnames else wb.sheetnames[0])
        ws = wb[summary_sheet_name]
        total_amount = sum(track['Сумма, руб.'] for track in tracks.values())
        _set_cell(ws, 'B10', artist)                           # Артист
        _set_cell(ws, 'B4', artists_data[artist][2])           # Договор (B4:F4 объединены)
        _set_cell(ws, 'B6', artists_data[artist][0])          # Лицензиар / ФИО полное (B6:F6 объединены)
        _set_cell(ws, 'E14', total_amount)                     # Доход в форме контента (или F14, если шаблон с F)
        _set_cell(ws, 'D15', artists_data[artist][3])          # Процент (D15 — не трогать E15, иначе затрёт процент)
        _set_cell(ws, 'F15', total_amount)                     # Итого доход Лицензиара — сумма в F15
        _set_cell(ws, 'E26', total_amount)                     # Начислено вознаграждение (E26, не D26 — D26 в объединении с подписью)
        _set_cell(ws, 'E28', total_amount)                     # К выплате за период
        _set_cell(ws, 'D32', artists_data[artist][0])         # Лицензиар ФИО (повтор)
        _set_cell(ws, 'E37', artists_data[artist][1])         # ФИО кратко (E37:F37 объединены)
        ws_artist = wb.create_sheet(title=artist)
        ws_artist.append(['Код', 'Исполнитель', 'Наименование', 'Альбом', 'Количество', 'Сумма, руб.', 'Доля, %'])
        total_quantity = 0
        total_amount = 0
        for (track_code, performer, name, album), track in tracks.items():
            data = [track_code, performer, name, album, track['Количество'], track['Сумма, руб.'], track['Доля']]
            ws_artist.append(data)
            total_quantity += track['Количество']
            total_amount += track['Сумма, руб.']
        ws_artist.append(['Итого', '', '', '', total_quantity, total_amount, ''])
        wb.save(artist_file_path)
        created_files.append(artist_file_path)
        
        # Создаем метаданные для отчета
        total_plays = sum(track['Количество'] for track in tracks.values())
        total_amount = sum(track['Сумма, руб.'] for track in tracks.values())
        
        report_metadata = {
            "id": f"report_{artist}_{quarter}_{year}_{int(time.time())}",
            "artistId": artist if is_registered else None,
            "artistName": artist,
            "quarter": quarter,
            "year": year,
            "fileName": f"{artist}.xlsx",
            "filePath": artist_file_path,
            "uploadDate": time.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
            "status": "processed",
            "totalPlays": total_plays,
            "totalAmount": total_amount,
            "isRegistered": is_registered,
            "isSigned": False,  # По умолчанию не подписан
            "isPaid": False     # По умолчанию не выплачен
        }
        
        reports_metadata.append(report_metadata)
    
    # Сохраняем все метаданные в reports.json
    save_all_reports_metadata(reports_metadata)
    
    print(f"Всего создано файлов: {len(created_files)}")
    print(f"Зарегистрированных артистов: {sum(1 for artist in artists_tracks.keys() if artist in registered_users)}")
    print(f"Незарегистрированных артистов: {sum(1 for artist in artists_tracks.keys() if artist not in registered_users)}")
    return created_files

def save_all_reports_metadata(new_reports):
    """Сохраняет метаданные всех отчетов в reports.json"""
    reports_file = 'data/reports.json'
    existing_reports = []
    
    # Загружаем существующие отчеты
    if os.path.exists(reports_file):
        with open(reports_file, 'r', encoding='utf-8') as f:
            existing_reports = json.load(f)
    
    # Добавляем новые отчеты
    existing_reports.extend(new_reports)
    
    # Сохраняем обновленный список
    os.makedirs('data', exist_ok=True)
    with open(reports_file, 'w', encoding='utf-8') as f:
        json.dump(existing_reports, f, ensure_ascii=False, indent=2)
    
    print(f"Сохранено {len(new_reports)} новых отчетов в reports.json")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Использование: python python-report-processor.py <путь_к_файлу> <квартал> <год> [путь_к_файлу_долей]")
        print("Примечание: Данные артистов берутся из data/users.json (только артисты с указанным percentage)")
        sys.exit(1)
    
    file_path = sys.argv[1]
    quarter = sys.argv[2]
    year = int(sys.argv[3])
    royalty_file_path = sys.argv[4] if len(sys.argv) > 4 else None
    
    try:
        created_files = process_file(file_path, quarter, year, royalty_file_path)
        print("Обработка завершена успешно!")
        print(f"Созданные файлы: {created_files}")
    except Exception as e:
        print(f"Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
