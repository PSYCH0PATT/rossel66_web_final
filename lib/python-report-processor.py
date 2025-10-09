import pandas as pd
from openpyxl import load_workbook
import shutil
import os
import re
import json
import sys
import time
from collections import defaultdict

# Путь к шаблону (копируем из оригинального проекта)
TEMPLATE_PATH = "OtchetyAppFinal/2Отчёт шаблон.xlsx"

# Пути к Excel файлам вместо Google Sheets (ТОЧНО как в MAIN_MAY.py)
ARTISTS_EXCEL_PATH = "artists.xlsx"  # Файл со списком артистов
ROYALTY_SHARES_EXCEL_PATH = "royalty_shares.xlsx"  # Файл с долями артистов

def get_artists_list():
    # Возвращаем пустой словарь (как в оригинале, но для всех артистов)
    return {}

def get_royalty_shares():
    # Возвращаем пустой словарь (как в оригинале)
    return {}

def get_artists_list_from_file(file_path):
    """Читает данные артистов из переданного файла"""
    try:
        df = pd.read_excel(file_path)
        artists_dict = {}
        for _, row in df.iterrows():
            key = row.iloc[0]
            values = row.iloc[1:].tolist()
            artists_dict[key] = values
        return artists_dict
    except Exception as e:
        print(f"Ошибка при чтении файла артистов: {e}")
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

def extract_artists_from_track(artist_str, artists_data):
    """Извлекает список артистов из строки исполнителя."""
    if not isinstance(artist_str, str):
        artist_str = str(artist_str)

    found_artists = []
    for artist in artists_data.keys():
        if re.search(re.escape(artist), artist_str, re.IGNORECASE):
            found_artists.append(artist)
    return found_artists

def calculate_artist_share(track_code, artist, all_artists_in_track, artists_data, royalty_shares):
    if len(all_artists_in_track) == 1:
        return 1.0
    if track_code in royalty_shares:
        track_shares = royalty_shares[track_code]
        if artist in track_shares:
            return track_shares[artist]
    if all(a in artists_data for a in all_artists_in_track):
        return 1.0 / len(all_artists_in_track)
    our_artists_count = sum(1 for a in all_artists_in_track if a in artists_data)
    if our_artists_count > 0:
        return 1.0 / our_artists_count
    return 0.0

def process_file(statement_path, quarter, year, artists_file_path=None, royalty_file_path=None):
    """Обработка файла с единым хранилищем отчетов"""
    # Создаем единую папку для всех отчетов
    reports_dir = f'data/reports/{quarter}'
    os.makedirs(reports_dir, exist_ok=True)
    
    # Загружаем список пользователей для проверки
    users_file = 'data/users.json'
    registered_users = set()
    if os.path.exists(users_file):
        with open(users_file, 'r', encoding='utf-8') as f:
            users_data = json.load(f)
            registered_users = {user['username'] for user in users_data}
    
    statement_df = pd.read_excel(statement_path, sheet_name='TDSheet')
    
    # Используем переданные файлы или пустые словари
    if artists_file_path and os.path.exists(artists_file_path):
        artists_data = get_artists_list_from_file(artists_file_path)
    else:
        artists_data = get_artists_list()
        
    if royalty_file_path and os.path.exists(royalty_file_path):
        royalty_shares = get_royalty_shares_from_file(royalty_file_path)
    else:
        royalty_shares = get_royalty_shares()
    artists_tracks = defaultdict(lambda: defaultdict(lambda: {'Количество': 0, 'Сумма, руб.': 0, 'Доля': 0}))
    for _, row in statement_df.iterrows():
        track_code = row['Код']
        artist_str = row['Исполнитель']
        track_artists = extract_artists_from_track(artist_str, artists_data)
        if not track_artists:
            continue
        for artist in track_artists:
            share = calculate_artist_share(track_code, artist, track_artists, artists_data, royalty_shares)
            amount_share = row['Сумма, руб.'] * share
            track_key = (track_code, row['Исполнитель'], row['Наименование'], row['Альбом'])
            artists_tracks[artist][track_key]['Количество'] += row['Количество']
            artists_tracks[artist][track_key]['Сумма, руб.'] += amount_share
            artists_tracks[artist][track_key]['Доля'] = share * 100

    created_files = []
    reports_metadata = []
    
    for artist, tracks in artists_tracks.items():
        # Все файлы сохраняем в единую папку
        artist_file_path = os.path.join(reports_dir, f'{artist}.xlsx')
        is_registered = artist in registered_users
        
        print(f"Создаем отчет для {'зарегистрированного' if is_registered else 'незарегистрированного'} артиста: {artist}")
        
        shutil.copy(TEMPLATE_PATH, artist_file_path)
        wb = load_workbook(artist_file_path)
        if 'Итог' in wb.sheetnames:
            ws = wb['Итог']
            ws['B10'] = artist
            total_amount = sum(track['Сумма, руб.'] for track in tracks.values())
            ws['E14'] = total_amount
            if artist in artists_data:
                ws['B6'] = artists_data[artist][0]
                ws['B4'] = artists_data[artist][2]
                ws['D15'] = artists_data[artist][3]
                ws['D32'] = artists_data[artist][0]
                ws['E37'] = artists_data[artist][1]
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
        print("Использование: python python-report-processor.py <путь_к_файлу> <квартал> <год> [путь_к_файлу_артистов] [путь_к_файлу_долей]")
        sys.exit(1)
    
    file_path = sys.argv[1]
    quarter = sys.argv[2]
    year = int(sys.argv[3])
    artists_file_path = sys.argv[4] if len(sys.argv) > 4 else None
    royalty_file_path = sys.argv[5] if len(sys.argv) > 5 else None
    
    try:
        created_files = process_file(file_path, quarter, year, artists_file_path, royalty_file_path)
        print("Обработка завершена успешно!")
        print(f"Созданные файлы: {created_files}")
    except Exception as e:
        print(f"Ошибка: {e}")
        sys.exit(1)
