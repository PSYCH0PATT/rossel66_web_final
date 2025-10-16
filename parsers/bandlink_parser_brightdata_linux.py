#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Linux с Bright Data Web Unlocker API
Финальная версия для продакшена
"""

import json
import time
import random
import os
import sqlite3
import sys
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('bandlink_parser_brightdata.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class BrightDataUnlocker:
    """Класс для работы с Bright Data Web Unlocker API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.brightdata.com/request"
        self.zone = "web_unlocker1"
        self.max_attempts = 3
        self.request_count = 0
        self.cost_estimate = 0.0  # $1.50 за CPM
        
    def unlock_url(self, url: str) -> Dict:
        """
        Разблокирует URL через Bright Data API
        Автоматически решает капчи
        """
        self.request_count += 1
        self.cost_estimate += 0.0015  # $1.50/1000 = $0.0015 за запрос
        
        try:
            logger.info(f"🔓 Запрос #{self.request_count}: {url}")
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "zone": self.zone,
                "url": url,
                "format": "raw"
            }
            
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                content = response.text
                logger.info(f"✅ Успешно получен HTML ({len(content)} символов)")
                
                return {
                    'success': True,
                    'html': content,
                    'status_code': 200
                }
            else:
                logger.error(f"❌ Ошибка API: {response.status_code}")
                return {
                    'success': False,
                    'error': f'API error {response.status_code}',
                    'status_code': response.status_code
                }
                
        except Exception as e:
            logger.error(f"❌ Ошибка запроса: {e}")
            return {
                'success': False,
                'error': str(e)
            }

class BandlinkParserBrightDataLinux:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists_brightdata.db'
        self.unlocker = None
        
        # Защита от множественных запросов
        self.max_requests = 50  # Максимум 50 запросов за сессию
        
        logger.info("="*60)
        logger.info("🚀 Bandlink Parser с Bright Data Web Unlocker API")
        logger.info(f"🛡️ Защита: макс {self.max_requests} запросов за сессию")
        logger.info("="*60)
        
        self.init_database()
        self.init_unlocker()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        logger.info(f"🔍 Загрузка конфига: {self.config_file}")
        
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    logger.info(f"✅ Конфиг загружен")
                    logger.info(f"🎵 Артистов для парсинга: {len(config.get('target_artists', []))}")
                    return config
            except Exception as e:
                logger.error(f"❌ Ошибка загрузки конфигурации: {e}")
        
        return {"target_artists": [], "bright_data_api_key": None}
    
    def init_database(self):
        """Инициализирует базу данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artist_name TEXT NOT NULL,
                    playlist_name TEXT NOT NULL,
                    playlist_artist TEXT,
                    track_names TEXT,
                    likes_count TEXT,
                    platform TEXT,
                    playlist_cover_url TEXT,
                    playlist_url TEXT,
                    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(artist_name, playlist_name)
                )
            ''')
            
            conn.commit()
            conn.close()
            logger.info(f"✅ База данных инициализирована: {self.db_path}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации БД: {e}")
    
    def init_unlocker(self):
        """Инициализирует Bright Data Unlocker"""
        api_key = self.config.get('bright_data_api_key')
        
        if not api_key:
            logger.error("❌ Bright Data API ключ не найден в конфиге!")
            return
        
        try:
            self.unlocker = BrightDataUnlocker(api_key)
            logger.info("✅ Bright Data Unlocker инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации Unlocker: {e}")
    
    def search_artist(self, artist_name: str) -> bool:
        """Ищет артиста через Bright Data API"""
        try:
            logger.info(f"🔍 Поиск артиста: {artist_name}")
            
            # Формируем URL для поиска
            search_url = f"https://band.link/scanner?q={artist_name}"
            
            # Получаем HTML через Bright Data
            result = self.unlocker.unlock_url(search_url)
            
            if not result['success']:
                logger.error(f"❌ Не удалось получить страницу поиска")
                return False
            
            html = result['html']
            
            # Проверяем наличие результатов (упрощенная проверка)
            if artist_name.lower() in html.lower():
                logger.info(f"✅ Артист найден в результатах")
                return True
            else:
                logger.warning(f"⚠️ Артист не найден в результатах")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка поиска артиста: {e}")
            return False
    
    def parse_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты артиста через Bright Data API"""
        try:
            logger.info(f"📋 Парсинг плейлистов для: {artist_name}")
            
            # Формируем URL страницы артиста
            # Примечание: нужен реальный URL формат band.link для артиста
            artist_url = f"https://band.link/artist/{artist_name.replace(' ', '_')}"
            
            # Получаем HTML через Bright Data
            result = self.unlocker.unlock_url(artist_url)
            
            if not result['success']:
                logger.error(f"❌ Не удалось получить страницу артиста")
                return []
            
            html = result['html']
            
            # TODO: Здесь нужно добавить реальный парсинг HTML
            # Сейчас заглушка для демонстрации работы API
            playlists = []
            
            logger.info(f"✅ Получен HTML страницы артиста ({len(html)} символов)")
            logger.info(f"📋 Найдено плейлистов: {len(playlists)}")
            
            return playlists
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга плейлистов: {e}")
            return []
    
    def save_playlists_to_db(self, artist_name: str, playlists: List[Dict]):
        """Сохраняет плейлисты в базу данных"""
        try:
            if not playlists:
                logger.info("📋 Нет плейлистов для сохранения")
                return
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            saved_count = 0
            for playlist in playlists:
                try:
                    cursor.execute('''
                        INSERT OR REPLACE INTO playlists 
                        (artist_name, playlist_name, playlist_artist, track_names, 
                         likes_count, platform, playlist_cover_url, playlist_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        artist_name,
                        playlist.get('name', ''),
                        playlist.get('artist', ''),
                        json.dumps(playlist.get('tracks', [])),
                        playlist.get('likes', ''),
                        playlist.get('platform', ''),
                        playlist.get('cover_url', ''),
                        playlist.get('url', '')
                    ))
                    saved_count += 1
                except sqlite3.IntegrityError:
                    logger.debug(f"Плейлист уже существует: {playlist.get('name')}")
            
            conn.commit()
            conn.close()
            
            logger.info(f"💾 Сохранено плейлистов: {saved_count}/{len(playlists)}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения в БД: {e}")
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        logger.info("="*60)
        logger.info("🚀 ЗАПУСК ПАРСЕРА")
        logger.info("="*60)
        logger.info(f"⏰ Время начала: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        if not self.unlocker:
            logger.error("❌ Bright Data Unlocker не инициализирован!")
            return
        
        artists = self.config.get('target_artists', [])
        
        if not artists:
            logger.error("❌ Нет артистов для парсинга!")
            return
        
        logger.info(f"📋 Начинаем парсинг {len(artists)} артистов...")
        
        results = []
        
        for idx, artist in enumerate(artists, 1):
            logger.info("="*60)
            logger.info(f"🎵 Артист {idx}/{len(artists)}: {artist}")
            logger.info("="*60)
            
            try:
                # Проверяем лимит запросов
                if self.unlocker.request_count >= self.max_requests:
                    logger.error(f"❌ Достигнут лимит запросов: {self.max_requests}")
                    break
                
                # Ищем артиста
                if not self.search_artist(artist):
                    logger.error(f"❌ Не удалось найти артиста: {artist}")
                    continue
                
                # Парсим плейлисты
                playlists = self.parse_playlists(artist)
                
                # Сохраняем в БД
                self.save_playlists_to_db(artist, playlists)
                
                results.append({
                    'artist_name': artist,
                    'playlists_count': len(playlists),
                    'status': 'success'
                })
                
                # Пауза между артистами
                time.sleep(random.uniform(1, 2))
                
            except Exception as e:
                logger.error(f"❌ Критическая ошибка парсинга: {e}")
                import traceback
                logger.error(f"🔍 Трассировка: {traceback.format_exc()}")
                results.append({
                    'artist_name': artist,
                    'status': 'error',
                    'error': str(e)
                })
        
        logger.info("="*60)
        logger.info("✅ ПАРСИНГ ЗАВЕРШЕН!")
        logger.info("="*60)
        logger.info(f"⏰ Время окончания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"📊 СТАТИСТИКА:")
        logger.info(f"   - Артистов обработано: {len(results)}")
        logger.info(f"   - Запросов к Bright Data: {self.unlocker.request_count}")
        logger.info(f"   - Оценка стоимости: ${self.unlocker.cost_estimate:.4f}")
        logger.info("="*60)
        
        # Выводим JSON результат для API
        print(json.dumps(results, ensure_ascii=False))

def main():
    """Главная функция"""
    logger.info("🔍 Аргументы запуска:")
    logger.info(f"   sys.argv: {sys.argv}")
    
    if len(sys.argv) < 2:
        logger.error("❌ Не указан конфиг файл!")
        logger.error("Использование: python3 bandlink_parser_brightdata_linux.py <config.json>")
        sys.exit(1)
    
    config_file = sys.argv[1]
    logger.info(f"📁 Конфиг файл: {config_file}")
    
    parser = BandlinkParserBrightDataLinux(config_file)
    parser.run_parsing_cycle()

if __name__ == "__main__":
    main()

