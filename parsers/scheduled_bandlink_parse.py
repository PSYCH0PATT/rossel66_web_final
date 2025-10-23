#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автоматический запуск Bandlink парсера по расписанию
Проверяет статус cookies и запускает парсинг для всех артистов
"""

import json
import logging
import os
import sqlite3
import sys
import subprocess
from datetime import datetime
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/scheduled_bandlink.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# Путь к проекту
PROJECT_ROOT = Path(__file__).parent.parent
DB_PATH = PROJECT_ROOT / 'bandlink_playlists.db'
DATA_DIR = PROJECT_ROOT / 'data'


def check_cookies_status():
    """Проверка статуса cookies"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Проверяем статус парсера
        cursor.execute("""
            SELECT needs_new_cookies, failed_attempts 
            FROM parser_status 
            WHERE id = 1
        """)
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            needs_new_cookies, failed_attempts = row
            return needs_new_cookies == 0, failed_attempts
        else:
            # Если записи нет, считаем что всё ок
            return True, 0
            
    except sqlite3.Error as e:
        logger.error(f"❌ Ошибка проверки статуса cookies: {e}")
        return False, 0


def get_recent_artists():
    """Получение артистов с релизами за последние 2 недели"""
    try:
        from datetime import timedelta
        
        # Путь к файлам
        users_file = DATA_DIR / 'users.json'
        releases_file = DATA_DIR / 'releases.json'
        
        if not users_file.exists():
            logger.error(f"❌ Файл пользователей не найден: {users_file}")
            return []
        
        if not releases_file.exists():
            logger.error(f"❌ Файл релизов не найден: {releases_file}")
            return []
        
        # Загружаем данные
        with open(users_file, 'r', encoding='utf-8') as f:
            users = json.load(f)
        
        with open(releases_file, 'r', encoding='utf-8') as f:
            releases = json.load(f)
        
        # Получаем дату 2 недели назад
        two_weeks_ago = datetime.now() - timedelta(days=14)
        logger.info(f"📅 Ищем релизы после: {two_weeks_ago.strftime('%Y-%m-%d')}")
        
        # Фильтруем релизы за последние 2 недели
        recent_releases = []
        for release in releases:
            try:
                release_date = datetime.fromisoformat(release['releaseDate'].replace('Z', '+00:00'))
                if release_date >= two_weeks_ago:
                    recent_releases.append(release)
            except (ValueError, KeyError) as e:
                logger.warning(f"⚠️ Не удалось распарсить дату релиза: {e}")
                continue
        
        logger.info(f"📀 Найдено {len(recent_releases)} релизов за последние 2 недели")
        
        # Получаем уникальных артистов из недавних релизов
        artist_ids = set(release['artistId'] for release in recent_releases)
        
        # Находим имена артистов
        recent_artists = []
        for artist_id in artist_ids:
            # Пробуем разные форматы ID
            user = None
            for u in users:
                if (u['id'] == artist_id or 
                    u['id'] == artist_id.replace('user_', '') or
                    f"user_{u['id']}" == artist_id or
                    u['id'].replace('artist', 'user_') == artist_id or
                    u['id'].replace('user_', 'artist') == artist_id):
                    user = u
                    break
            
            if user and user.get('role') == 'artist':
                artist_releases = [r for r in recent_releases if r['artistId'] == artist_id]
                recent_artists.append({
                    'name': user['name'],
                    'id': user['id'],
                    'releases_count': len(artist_releases)
                })
        
        # Сортируем по количеству релизов (больше релизов = выше приоритет)
        recent_artists.sort(key=lambda x: x['releases_count'], reverse=True)
        
        artist_names = [artist['name'] for artist in recent_artists]
        
        logger.info(f"🎤 Найдено {len(artist_names)} артистов с недавними релизами:")
        for artist in recent_artists:
            logger.info(f"   - {artist['name']}: {artist['releases_count']} релиз(ов)")
        
        return artist_names
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения списка артистов с недавними релизами: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


def create_parser_config(artists):
    """Создание временного конфига для парсера"""
    config = {
        "target_artists": artists,
        "bright_data_proxy_username": os.environ.get(
            'BRIGHT_DATA_RESIDENTIAL_USERNAME', 
            'brd-customer-hl_94d02fd9-zone-residential_proxy1'
        ),
        "bright_data_proxy_password": os.environ.get(
            'BRIGHT_DATA_RESIDENTIAL_PASSWORD', 
            'juze73q9d91q'
        ),
        "proxy_host": "brd.superproxy.io",
        "proxy_port": 33335
    }
    
    config_path = PROJECT_ROOT / 'temp_scheduled_bandlink_config.json'
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, indent=2, fp=f)
    
    return config_path


def run_parser(config_path):
    """Запуск парсера"""
    parser_script = PROJECT_ROOT / 'parsers' / 'bandlink_parser_residential_selenium.py'
    
    logger.info(f"🚀 Запуск парсера: {parser_script}")
    logger.info(f"📄 Конфиг: {config_path}")
    
    try:
        result = subprocess.run(
            ['python3', str(parser_script), str(config_path)],
            capture_output=True,
            text=True,
            timeout=3600  # Таймаут 1 час
        )
        
        # Логируем вывод парсера
        if result.stdout:
            logger.info("📝 Вывод парсера:")
            for line in result.stdout.splitlines():
                logger.info(f"  {line}")
        
        if result.stderr:
            logger.error("❌ Ошибки парсера:")
            for line in result.stderr.splitlines():
                logger.error(f"  {line}")
        
        if result.returncode == 0:
            logger.info("✅ Парсинг завершен успешно")
            return True
        else:
            logger.error(f"❌ Парсинг завершился с ошибкой (код {result.returncode})")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Превышен таймаут выполнения парсера (1 час)")
        return False
    except Exception as e:
        logger.error(f"❌ Ошибка запуска парсера: {e}")
        return False
    finally:
        # Удаляем временный конфиг
        if config_path.exists():
            config_path.unlink()


def send_notification(message):
    """Отправка уведомления (можно расширить для email/telegram)"""
    logger.warning(f"📨 УВЕДОМЛЕНИЕ: {message}")
    
    # TODO: Добавить отправку email или Telegram уведомлений
    # Пока просто логируем
    
    # Также можно сохранить в БД для отображения в админке
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE parser_status 
            SET status = 'notification_sent'
            WHERE id = 1
        """)
        
        conn.commit()
        conn.close()
        
    except sqlite3.Error as e:
        logger.error(f"❌ Ошибка сохранения уведомления: {e}")


def main():
    """Основная функция"""
    logger.info("="*60)
    logger.info("🕐 ЗАПУСК АВТОМАТИЧЕСКОГО ПАРСИНГА BANDLINK")
    logger.info(f"⏰ Время: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)
    
    # Проверяем статус cookies
    logger.info("🍪 Проверка статуса cookies...")
    cookies_ok, failed_attempts = check_cookies_status()
    
    if not cookies_ok:
        error_msg = f"⚠️ Требуются новые cookies! Парсинг остановлен после {failed_attempts} неудачных попыток."
        logger.error(error_msg)
        send_notification(error_msg)
        sys.exit(1)
    
    logger.info("✅ Cookies актуальны")
    
    # Получаем список артистов с недавними релизами
    logger.info("📋 Получение артистов с релизами за последние 2 недели...")
    artists = get_recent_artists()
    
    if not artists:
        logger.error("❌ Список артистов пуст. Парсинг отменен.")
        sys.exit(1)
    
    logger.info(f"✅ Будет обработано {len(artists)} артистов")
    
    # Создаем конфиг
    logger.info("📝 Создание конфигурации...")
    config_path = create_parser_config(artists)
    
    # Запускаем парсер
    logger.info("🚀 Запуск парсинга...")
    success = run_parser(config_path)
    
    # Итоги
    logger.info("="*60)
    if success:
        logger.info("🎉 АВТОМАТИЧЕСКИЙ ПАРСИНГ ЗАВЕРШЕН УСПЕШНО")
    else:
        logger.error("❌ АВТОМАТИЧЕСКИЙ ПАРСИНГ ЗАВЕРШЕН С ОШИБКАМИ")
        send_notification("Автоматический парсинг Bandlink завершен с ошибками")
    logger.info("="*60)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    # Создаем директорию для логов если не существует
    logs_dir = Path('logs')
    logs_dir.mkdir(exist_ok=True)
    
    main()

