#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Linux с Residential Proxy
Максимально очеловеченный парсер с минимизацией капчи
"""

import json
import logging
import os
import sqlite3
import sys
import time
import random
import uuid
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

# Список реальных User-Agent для ротации
USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
]


class ResidentialProxyParser:
    """Класс для работы с Bright Data Residential Proxy"""
    
    def __init__(self, username: str, password: str, host: str = "brd.superproxy.io", port: int = 33335):
        """
        Инициализация Residential Proxy парсера
        
        Args:
            username: Proxy username (формат: brd-customer-xxx-zone-residential_xxx)
            password: Proxy password
            host: Proxy host
            port: Proxy port
        """
        self.proxy_username = username
        self.proxy_password = password
        self.proxy_host = host
        self.proxy_port = port
        
        self.current_session_id = None
        self.captcha_attempts = 0
        self.max_captcha_attempts = 5
        
        # База данных для cookies
        self.db_path = os.path.join(os.path.dirname(__file__), '..', 'bandlink_playlists.db')
        
        logger.info("🔧 Инициализация Residential Proxy парсера...")
        logger.info(f"🌐 Proxy: {self.proxy_host}:{self.proxy_port}")
        logger.info(f"👤 Username: {self.proxy_username[:50]}...")
        logger.info(f"🔐 Password: {'*' * len(self.proxy_password)}")
    
    def get_random_user_agent(self) -> str:
        """Возвращает случайный User-Agent"""
        return random.choice(USER_AGENTS)
    
    def human_delay(self, min_sec: float = 3, max_sec: float = 8):
        """Имитация человеческой задержки"""
        delay = random.uniform(min_sec, max_sec)
        logger.info(f"⏱️  Задержка {delay:.2f} сек (имитация человека)")
        time.sleep(delay)
    
    def reading_delay(self):
        """Имитация времени чтения страницы"""
        delay = random.uniform(2, 5)
        logger.info(f"📖 Имитация чтения страницы {delay:.2f} сек")
        time.sleep(delay)
    
    def get_cookies_from_db(self) -> Dict[str, str]:
        """Загрузка cookies из SQLite базы данных"""
        cookies = {}
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT cookie_name, cookie_value FROM bandlink_cookies")
            rows = cursor.fetchall()
            
            for row in rows:
                cookies[row[0]] = row[1]
            
            conn.close()
            
            if cookies:
                logger.info(f"🍪 Загружено {len(cookies)} cookies из БД")
            else:
                logger.warning("⚠️  Cookies не найдены в БД")
                
        except sqlite3.Error as e:
            logger.error(f"❌ Ошибка загрузки cookies из БД: {e}")
        
        return cookies
    
    def update_parser_status(self, status: str, needs_new_cookies: int = 0, failed_attempts: int = 0):
        """Обновление статуса парсера в БД"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO parser_status (id, status, last_run, needs_new_cookies, failed_attempts)
                VALUES (1, ?, ?, ?, ?)
            """, (status, datetime.now().isoformat(), needs_new_cookies, failed_attempts))
            
            conn.commit()
            conn.close()
            
            logger.info(f"📊 Статус парсера обновлен: {status}")
            
        except sqlite3.Error as e:
            logger.error(f"❌ Ошибка обновления статуса: {e}")
    
    def get_new_session_id(self) -> str:
        """Генерация нового session ID для ротации IP"""
        session_id = str(uuid.uuid4())[:8]
        logger.info(f"🔄 Новый session ID: {session_id}")
        return session_id
    
    def make_request(self, url: str, cookies: Dict[str, str] = None, retry_on_captcha: bool = True) -> Dict:
        """
        Выполнение запроса через Residential Proxy
        
        Args:
            url: URL для запроса
            cookies: Cookies для запроса
            retry_on_captcha: Повторять при обнаружении капчи
        
        Returns:
            dict: {'success': bool, 'html': str, 'error': str}
        """
        # Формируем proxy username с session ID (если есть)
        proxy_username = self.proxy_username
        if self.current_session_id:
            proxy_username = f"{self.proxy_username}-session-{self.current_session_id}"
        
        # Настраиваем proxy
        proxies = {
            'http': f'http://{proxy_username}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}',
            'https': f'http://{proxy_username}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}'
        }
        
        # Случайный User-Agent
        user_agent = self.get_random_user_agent()
        
        # Заголовки запроса
        headers = {
            'User-Agent': user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://band.link/manage/bandlinks',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Priority': 'u=0, i'
        }
        
        logger.info(f"📤 Запрос к: {url}")
        logger.info(f"   Proxy session: {self.current_session_id or 'default'}")
        logger.info(f"   User-Agent: {user_agent[:60]}...")
        logger.info(f"   Cookies: {len(cookies) if cookies else 0}")
        
        try:
            response = requests.get(
                url,
                proxies=proxies,
                headers=headers,
                cookies=cookies,
                verify=False,
                timeout=30
            )
            
            logger.info(f"📊 Статус ответа: {response.status_code}")
            logger.info(f"📊 Размер ответа: {len(response.text)} символов")
            
            # Проверяем заголовки Bright Data
            for header_name in ['x-luminati-ip', 'x-brd-ip', 'x-luminati-timeline']:
                if header_name in response.headers:
                    logger.info(f"   {header_name}: {response.headers[header_name]}")
            
            if response.status_code == 200:
                html = response.text
                
                # Проверка на капчу
                captcha_detected = 'captcha' in html.lower() or 'showcaptcha' in html.lower()
                
                if captcha_detected:
                    self.captcha_attempts += 1
                    logger.warning(f"⚠️  КАПЧА ОБНАРУЖЕНА! Попытка {self.captcha_attempts} из {self.max_captcha_attempts}")
                    logger.warning(f"   URL: {url}")
                    logger.warning(f"   Timestamp: {datetime.now().isoformat()}")
                    
                    if retry_on_captcha and self.captcha_attempts < self.max_captcha_attempts:
                        # Переключаемся на новый IP
                        old_session = self.current_session_id or 'default'
                        self.current_session_id = self.get_new_session_id()
                        logger.info(f"🔄 Смена IP: {old_session} → {self.current_session_id}")
                        
                        # Задержка перед повтором (2-3 минуты)
                        wait_time = random.uniform(120, 180)
                        logger.info(f"⏱️  Ожидание {wait_time/60:.1f} минут перед повтором...")
                        time.sleep(wait_time)
                        
                        # Повторяем запрос
                        return self.make_request(url, cookies, retry_on_captcha=True)
                    
                    elif self.captcha_attempts >= self.max_captcha_attempts:
                        logger.error(f"❌ Достигнут лимит попыток ({self.max_captcha_attempts})")
                        logger.error("💡 Требуются новые cookies!")
                        
                        # Обновляем статус в БД
                        self.update_parser_status("failed", needs_new_cookies=1, failed_attempts=self.captcha_attempts)
                        
                        return {
                            'success': False,
                            'error': 'Капча не решена после 5 попыток. Требуются новые cookies.'
                        }
                
                # Успешный ответ без капчи
                logger.info("✅ Успешно! HTML получен без капчи")
                
                # Сброс счетчика попыток
                if self.captcha_attempts > 0:
                    logger.info(f"✅ Капча решена после {self.captcha_attempts} попыток")
                    self.captcha_attempts = 0
                
                return {
                    'success': True,
                    'html': html
                }
            else:
                error_msg = f"HTTP {response.status_code}"
                logger.error(f"❌ Ошибка: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка запроса: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def parse_artist_playlists(self, artist_name: str) -> List[Dict]:
        """
        Парсинг плейлистов артиста с band.link
        
        Args:
            artist_name: Имя артиста
        
        Returns:
            List[Dict]: Список найденных плейлистов
        """
        logger.info(f"🎵 Парсинг артиста: {artist_name}")
        
        # Загружаем cookies из БД
        cookies = self.get_cookies_from_db()
        
        if not cookies:
            logger.warning("⚠️  Парсинг без cookies может привести к капче")
        
        # Формируем URL
        search_query = artist_name.replace(' ', '+')
        url = f"https://band.link/scanner?search={search_query}"
        
        logger.info(f"🔗 URL: {url}")
        
        # Задержка перед запросом (очеловечивание)
        self.human_delay(3, 8)
        
        # Выполняем запрос
        result = self.make_request(url, cookies)
        
        if not result['success']:
            logger.error(f"❌ Не удалось получить данные для {artist_name}: {result.get('error')}")
            return []
        
        # Имитация чтения страницы
        self.reading_delay()
        
        # Парсинг HTML
        html = result['html']
        soup = BeautifulSoup(html, 'html.parser')
        
        playlists = []
        
        # Поиск плейлистов (логика зависит от структуры HTML)
        # Ищем ссылки на плейлисты разных платформ
        playlist_links = soup.find_all('a', href=True)
        
        platforms = {
            'spotify.com': 'Spotify',
            'music.apple.com': 'Apple Music',
            'music.youtube.com': 'YouTube Music',
            'youtube.com/playlist': 'YouTube',
            'music.yandex.ru': 'Яндекс Музыка',
            'vk.com/music': 'VK Музыка',
            'music.mts.ru': 'МТС Музыка'
        }
        
        found_playlists_count = 0
        
        for link in playlist_links:
            href = link.get('href', '')
            
            for platform_url, platform_name in platforms.items():
                if platform_url in href and 'playlist' in href.lower():
                    playlist_data = {
                        'artist_name': artist_name,
                        'platform': platform_name,
                        'playlist_url': href,
                        'parsed_at': datetime.now().isoformat()
                    }
                    playlists.append(playlist_data)
                    found_playlists_count += 1
                    logger.info(f"   ✅ Найден плейлист: {platform_name}")
                    break
        
        if found_playlists_count > 0:
            logger.info(f"🎉 Найдено {found_playlists_count} плейлистов для {artist_name}")
        else:
            logger.warning(f"⚠️  Плейлисты не найдены для {artist_name}")
        
        return playlists
    
    def save_playlists_to_db(self, playlists: List[Dict]):
        """Сохранение плейлистов в SQLite базу данных"""
        if not playlists:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Создаем таблицу если не существует
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS bandlink_playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artist_name TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    playlist_url TEXT NOT NULL UNIQUE,
                    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Вставляем плейлисты
            for playlist in playlists:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO bandlink_playlists (artist_name, platform, playlist_url, parsed_at)
                        VALUES (?, ?, ?, ?)
                    """, (
                        playlist['artist_name'],
                        playlist['platform'],
                        playlist['playlist_url'],
                        playlist['parsed_at']
                    ))
                except sqlite3.Error as e:
                    logger.error(f"❌ Ошибка вставки плейлиста: {e}")
            
            conn.commit()
            conn.close()
            
            logger.info(f"💾 Сохранено {len(playlists)} плейлистов в БД")
            
        except sqlite3.Error as e:
            logger.error(f"❌ Ошибка сохранения в БД: {e}")
    
    def run_parsing_cycle(self, artists: List[str]):
        """
        Запуск цикла парсинга для списка артистов
        
        Args:
            artists: Список имен артистов
        """
        logger.info(f"🚀 Запуск парсинга для {len(artists)} артистов")
        
        total_playlists = 0
        
        for i, artist_name in enumerate(artists, 1):
            logger.info(f"\n{'='*60}")
            logger.info(f"📍 Артист {i}/{len(artists)}: {artist_name}")
            logger.info(f"{'='*60}")
            
            playlists = self.parse_artist_playlists(artist_name)
            
            if playlists:
                self.save_playlists_to_db(playlists)
                total_playlists += len(playlists)
            
            # Задержка между артистами (очеловечивание)
            if i < len(artists):
                self.human_delay(5, 10)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"🎉 Парсинг завершен!")
        logger.info(f"📊 Всего найдено плейлистов: {total_playlists}")
        logger.info(f"{'='*60}")
        
        # Обновляем статус в БД (успешно)
        self.update_parser_status("completed", needs_new_cookies=0, failed_attempts=0)


def main():
    """Основная функция"""
    if len(sys.argv) < 2:
        logger.error("❌ Не указан файл конфигурации")
        logger.info("💡 Использование: python3 bandlink_parser_residential_linux.py <config.json>")
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    # Загружаем конфиг
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except Exception as e:
        logger.error(f"❌ Ошибка загрузки конфига: {e}")
        sys.exit(1)
    
    # Получаем параметры
    artists = config.get('target_artists', [])
    proxy_username = config.get('bright_data_proxy_username')
    proxy_password = config.get('bright_data_proxy_password')
    proxy_host = config.get('proxy_host', 'brd.superproxy.io')
    proxy_port = config.get('proxy_port', 33335)
    
    if not artists:
        logger.error("❌ Список артистов пуст")
        sys.exit(1)
    
    if not proxy_username or not proxy_password:
        logger.error("❌ Не указаны Residential proxy credentials")
        sys.exit(1)
    
    # Создаем парсер
    parser = ResidentialProxyParser(
        username=proxy_username,
        password=proxy_password,
        host=proxy_host,
        port=proxy_port
    )
    
    # Запускаем парсинг
    parser.run_parsing_cycle(artists)


if __name__ == "__main__":
    main()




