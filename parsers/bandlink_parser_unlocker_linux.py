#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Linux с Bright Data Web Unlocker API
Использует Web Unlocker API для автоматического решения Yandex SmartCaptcha
"""

import json
import logging
import os
import sqlite3
import sys
import time
from datetime import datetime
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
import urllib3

# Отключаем предупреждения о непроверенных SSL сертификатах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class BrightDataUnlockerAPI:
    """Класс для работы с Bright Data Web Unlocker через PROXY"""
    
    def __init__(self, username: str, password: str, zone: str = "web_unlocker1"):
        """
        Инициализация Web Unlocker API
        
        Args:
            username: Proxy username (формат: brd-customer-{customer_id}-zone-{zone_name})
            password: Proxy password
            zone: Зона (по умолчанию web_unlocker1)
        """
        self.zone = zone
        self.proxy_host = "brd.superproxy.io"
        self.proxy_port = 33335
        
        # Учетные данные для proxy
        self.proxy_username = username
        self.proxy_password = password
        
        self.request_count = 0
        self.max_requests = 50  # Защита от бесконечных запросов
        
        logger.info("🔧 Инициализация Bright Data Web Unlocker (PROXY режим)...")
        logger.info(f"🌐 Proxy: {self.proxy_host}:{self.proxy_port}")
        logger.info(f"👤 Username: {self.proxy_username[:50]}...")
        logger.info(f"🔐 Password: {'*' * len(self.proxy_password)}")
    
    def unlock_url(self, url: str, country: str = "us") -> Dict:
        """
        Получает HTML страницы через Web Unlocker PROXY
        Автоматически решает капчи (включая Yandex SmartCaptcha)
        
        Args:
            url: URL для разблокировки
            country: Код страны для геотаргетинга (по умолчанию "us")
        
        Returns:
            dict: {'success': bool, 'html': str, 'error': str}
        """
        if self.request_count >= self.max_requests:
            logger.error(f"🛡️ Достигнут лимит запросов: {self.max_requests}")
            return {
                'success': False,
                'error': f'Превышен лимит запросов ({self.max_requests})'
            }
        
        self.request_count += 1
        
        try:
            # Добавляем параметр country в username для геотаргетинга
            # Формат: brd-customer-{id}-zone-{zone}-country-{country}
            proxy_username_with_country = f"{self.proxy_username}-country-{country}"
            
            # Настраиваем proxy для requests
            proxies = {
                'http': f'http://{proxy_username_with_country}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}',
                'https': f'http://{proxy_username_with_country}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}'
            }
            
            logger.info(f"📤 Запрос #{self.request_count} через Web Unlocker PROXY")
            logger.info(f"   URL: {url}")
            logger.info(f"   Proxy: {self.proxy_host}:{self.proxy_port}")
            logger.info(f"   Country: {country}")
            
            # Отправляем обычный GET запрос через proxy
            # Proxy автоматически обходит капчу и блокировки
            response = requests.get(
                url,
                proxies=proxies,
                verify=False,  # Отключаем проверку SSL сертификата (-k в curl)
                timeout=120,   # 2 минуты на решение капчи
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            
            logger.info(f"📊 Статус ответа: {response.status_code}")
            
            if response.status_code == 200:
                html = response.text
                logger.info(f"✅ Успешно! Получено HTML: {len(html)} символов")
                
                # Проверяем заголовки ответа для отладки
                if 'x-brightdata-zone' in response.headers:
                    logger.info(f"🔍 Bright Data Zone: {response.headers.get('x-brightdata-zone')}")
                
                return {
                    'success': True,
                    'html': html
                }
            else:
                error_text = response.text[:500]  # Первые 500 символов
                logger.error(f"❌ Ошибка {response.status_code}: {error_text}")
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {error_text}'
                }
        
        except requests.exceptions.Timeout:
            logger.error("❌ Таймаут запроса (120 секунд)")
            return {'success': False, 'error': 'Timeout'}
        
        except requests.exceptions.ProxyError as e:
            logger.error(f"❌ Ошибка подключения к proxy: {e}")
            logger.error("Проверьте правильность username и password для Bright Data")
            return {'success': False, 'error': f'Proxy error: {str(e)}'}
        
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка HTTP: {e}")
            return {'success': False, 'error': str(e)}
        
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {'success': False, 'error': str(e)}


class BandlinkParserUnlockerLinux:
    """Парсер Bandlink с Bright Data Web Unlocker API для Linux"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = {}
        self.unlocker = None
        self.db_path = "bandlink_playlists_unlocker.db"
        self.target_artists = []
        
        logger.info("="*60)
        logger.info("🚀 BANDLINK PARSER С WEB UNLOCKER API (LINUX)")
        logger.info("="*60)
    
    def load_config(self) -> bool:
        """Загружает конфигурацию из JSON файла"""
        try:
            logger.info(f"📁 Загрузка конфига: {self.config_path}")
            
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
            
            logger.info("✅ Конфиг загружен")
            logger.info(f"📋 Ключи конфига: {list(self.config.keys())}")
            
            self.target_artists = self.config.get('target_artists', [])
            logger.info(f"🎵 Артистов для парсинга: {len(self.target_artists)}")
            
            return True
        
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки конфига: {e}")
            return False
    
    def init_database(self) -> bool:
        """Инициализирует SQLite базу данных"""
        try:
            logger.info(f"💾 Инициализация базы данных: {self.db_path}")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Создаем таблицу для плейлистов
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artist_name TEXT NOT NULL,
                    playlist_url TEXT NOT NULL,
                    playlist_name TEXT,
                    track_count INTEGER,
                    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(artist_name, playlist_url)
                )
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info("✅ База данных инициализирована")
            return True
        
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации БД: {e}")
            return False
    
    def init_unlocker(self) -> bool:
        """Инициализирует Web Unlocker API"""
        try:
            # Получаем учетные данные для proxy из конфига
            username = self.config.get('bright_data_proxy_username')
            password = self.config.get('bright_data_proxy_password')
            
            if not username or not password:
                logger.error("❌ Bright Data proxy credentials не найдены в конфиге!")
                logger.error("Необходимо указать 'bright_data_proxy_username' и 'bright_data_proxy_password'")
                logger.error("Формат username: brd-customer-{customer_id}-zone-{zone_name}")
                return False
            
            self.unlocker = BrightDataUnlockerAPI(username, password)
            logger.info("✅ Web Unlocker API инициализирован")
            return True
        
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации Unlocker API: {e}")
            return False
    
    def search_artist(self, artist_name: str) -> Optional[str]:
        """
        Ищет артиста через Web Unlocker API
        
        Args:
            artist_name: Имя артиста для поиска
        
        Returns:
            str: HTML страницы с результатами поиска или None
        """
        try:
            logger.info("="*60)
            logger.info(f"🔍 Поиск артиста: {artist_name}")
            logger.info("="*60)
            
            # Формируем URL для поиска (заменяем пробелы на +)
            search_query = artist_name.replace(' ', '+')
            search_url = f"https://band.link/scanner?search={search_query}"
            
            logger.info(f"🌐 URL поиска: {search_url}")
            logger.info(f"📝 Логика: band.link/scanner?search={search_query}")
            logger.info(f"🔄 Замена пробелов: '{artist_name}' → '{search_query}'")
            
            # Получаем HTML через Web Unlocker PROXY
            # Капча решается автоматически!
            result = self.unlocker.unlock_url(search_url, country="us")
            
            if not result['success']:
                logger.error(f"❌ Не удалось получить страницу: {result.get('error')}")
                return None
            
            html = result['html']
            logger.info(f"✅ Страница получена: {len(html)} символов")
            
            # Анализируем содержимое HTML
            logger.info("🔍 Анализ полученного HTML:")
            logger.info(f"  - Размер HTML: {len(html)} символов")
            logger.info(f"  - Содержит 'playlist': {'playlist' in html.lower()}")
            logger.info(f"  - Содержит 'track': {'track' in html.lower()}")
            logger.info(f"  - Содержит 'artist': {'artist' in html.lower()}")
            logger.info(f"  - Содержит 'captcha': {'captcha' in html.lower()}")
            
            # Кодируем HTML в base64 для передачи через API
            import base64
            html_b64 = base64.b64encode(html.encode('utf-8')).decode('utf-8')
            logger.info(f"HTML_BASE64_START:{html_b64}:HTML_BASE64_END")
            
            # Проверяем, нет ли капчи в HTML
            captcha_detected = 'captcha' in html.lower() or 'showcaptcha' in html.lower()
            if captcha_detected:
                logger.warning("⚠️ В HTML все еще присутствует капча!")
                logger.warning("Это может означать, что Web Unlocker API не смог решить капчу")
                logger.warning("Проверьте логи Bright Data на наличие ошибок")
                return None
            
            # Проверяем, есть ли данные о плейлистах
            if 'playlist' in html.lower() or 'track' in html.lower():
                logger.info("✅ HTML содержит данные о плейлистах/треках")
            else:
                logger.warning("⚠️ HTML не содержит данных о плейлистах/треках")
                logger.warning("Возможно, артист не найден или нет плейлистов")
            
            return html
        
        except Exception as e:
            logger.error(f"❌ Ошибка поиска артиста: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def parse_playlists(self, html: str, artist_name: str) -> List[Dict]:
        """
        Парсит плейлисты из HTML
        
        Args:
            html: HTML страницы с результатами
            artist_name: Имя артиста
        
        Returns:
            list: Список словарей с информацией о плейлистах
        """
        try:
            logger.info(f"📊 Парсинг плейлистов для: {artist_name}")
            
            soup = BeautifulSoup(html, 'html.parser')
            playlists = []
            
            # Ищем ссылки на плейлисты (примерные селекторы, нужно уточнить)
            playlist_links = soup.find_all('a', href=True)
            
            for link in playlist_links:
                href = link.get('href', '')
                
                # Фильтруем только ссылки на плейлисты
                if any(platform in href for platform in ['spotify.com', 'music.apple.com', 'youtube.com/playlist', 'music.yandex.ru']):
                    playlist_name = link.get_text(strip=True) or "Unknown"
                    
                    playlist_data = {
                        'artist_name': artist_name,
                        'playlist_url': href,
                        'playlist_name': playlist_name,
                        'track_count': 0  # Можно попытаться извлечь из HTML
                    }
                    
                    playlists.append(playlist_data)
                    logger.info(f"   ✓ {playlist_name}: {href[:80]}")
            
            logger.info(f"✅ Найдено плейлистов: {len(playlists)}")
            return playlists
        
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга плейлистов: {e}")
            return []
    
    def save_playlists_to_db(self, playlists: List[Dict]) -> bool:
        """Сохраняет плейлисты в базу данных"""
        try:
            if not playlists:
                logger.warning("⚠️ Нет плейлистов для сохранения")
                return True
            
            logger.info(f"💾 Сохранение {len(playlists)} плейлистов в БД...")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            saved_count = 0
            for playlist in playlists:
                try:
                    cursor.execute('''
                        INSERT OR IGNORE INTO playlists 
                        (artist_name, playlist_url, playlist_name, track_count)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        playlist['artist_name'],
                        playlist['playlist_url'],
                        playlist['playlist_name'],
                        playlist['track_count']
                    ))
                    
                    if cursor.rowcount > 0:
                        saved_count += 1
                
                except Exception as e:
                    logger.error(f"❌ Ошибка сохранения плейлиста: {e}")
            
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Сохранено новых плейлистов: {saved_count}")
            return True
        
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения в БД: {e}")
            return False
    
    def run_parsing_cycle(self) -> bool:
        """Запускает цикл парсинга для всех артистов"""
        try:
            logger.info("="*60)
            logger.info("🚀 ЗАПУСК ЦИКЛА ПАРСИНГА")
            logger.info("="*60)
            logger.info(f"⏰ Время начала: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"🎵 Артистов для обработки: {len(self.target_artists)}")
            
            success_count = 0
            failed_count = 0
            
            for i, artist_name in enumerate(self.target_artists, 1):
                logger.info("="*60)
                logger.info(f"📍 Артист {i}/{len(self.target_artists)}: {artist_name}")
                logger.info("="*60)
                logger.info(f"🎯 Цель: Найти плейлисты для артиста '{artist_name}'")
                logger.info(f"🌐 URL: https://band.link/scanner?search={artist_name.replace(' ', '+')}")
                
                # Поиск артиста (капча решается автоматически!)
                logger.info("🚀 Начинаем поиск артиста...")
                html = self.search_artist(artist_name)
                
                if not html:
                    logger.error(f"❌ Не удалось получить данные для {artist_name}")
                    logger.error("💡 Возможные причины:")
                    logger.error("  - Артист не найден на BandLink")
                    logger.error("  - Проблемы с Web Unlocker proxy")
                    logger.error("  - Капча не решена")
                    failed_count += 1
                    continue
                
                # Парсинг плейлистов
                logger.info("📊 Начинаем парсинг плейлистов...")
                playlists = self.parse_playlists(html, artist_name)
                
                if playlists:
                    logger.info(f"🎵 Найдено плейлистов: {len(playlists)}")
                    for j, playlist in enumerate(playlists, 1):
                        logger.info(f"  {j}. {playlist.get('playlist_name', 'Unknown')} - {playlist.get('playlist_url', 'No URL')}")
                else:
                    logger.warning("⚠️ Плейлисты не найдены")
                    logger.warning("💡 Возможные причины:")
                    logger.warning("  - У артиста нет плейлистов в BandLink")
                    logger.warning("  - Неправильные селекторы для парсинга")
                    logger.warning("  - HTML структура изменилась")
                
                # Сохранение в БД
                logger.info("💾 Сохраняем результаты в базу данных...")
                if self.save_playlists_to_db(playlists):
                    success_count += 1
                    logger.info(f"✅ Артист {artist_name} обработан успешно")
                    logger.info(f"📈 Статистика: {success_count} успешно, {failed_count} ошибок")
                else:
                    failed_count += 1
                    logger.error(f"❌ Ошибка сохранения данных для {artist_name}")
                
                # Пауза между артистами (уважаем сервис)
                if i < len(self.target_artists):
                    logger.info("⏳ Пауза 3 секунды перед следующим артистом...")
                    time.sleep(3)
            
            # Итоги
            logger.info("="*60)
            logger.info("📊 ИТОГИ ПАРСИНГА")
            logger.info("="*60)
            logger.info(f"✅ Успешно обработано: {success_count}")
            logger.info(f"❌ Ошибок: {failed_count}")
            logger.info(f"📊 Всего запросов к API: {self.unlocker.request_count}")
            logger.info(f"⏰ Время окончания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info("="*60)
            
            return failed_count == 0
        
        except Exception as e:
            logger.error(f"❌ Критическая ошибка в цикле парсинга: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False


def main():
    """Главная функция"""
    try:
        # Проверяем аргументы
        if len(sys.argv) < 2:
            logger.error("❌ Не указан путь к конфиг файлу!")
            logger.error("Использование: python3 bandlink_parser_unlocker_linux.py <config.json>")
            sys.exit(1)
        
        config_path = sys.argv[1]
        logger.info(f"📁 Конфиг файл: {config_path}")
        
        # Создаем парсер
        parser = BandlinkParserUnlockerLinux(config_path)
        
        # Загружаем конфиг
        if not parser.load_config():
            logger.error("❌ Не удалось загрузить конфиг!")
            sys.exit(1)
        
        # Инициализируем БД
        if not parser.init_database():
            logger.error("❌ Не удалось инициализировать БД!")
            sys.exit(1)
        
        # Инициализируем Web Unlocker API
        if not parser.init_unlocker():
            logger.error("❌ Не удалось инициализировать Web Unlocker API!")
            sys.exit(1)
        
        # Запускаем парсинг
        success = parser.run_parsing_cycle()
        
        if success:
            logger.info("✅ Парсинг завершен успешно!")
            sys.exit(0)
        else:
            logger.error("❌ Парсинг завершен с ошибками!")
            sys.exit(1)
    
    except KeyboardInterrupt:
        logger.warning("\n⚠️ Прервано пользователем")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()

