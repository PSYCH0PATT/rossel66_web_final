#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VK Parser - Интегрированный парсер для системы
"""

import json
import time
import random
import os
import sqlite3
import sys
from datetime import datetime
from typing import Dict, List, Optional

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

class VKParser:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'vk_playlists.db'
        self.driver = None
        self.init_database()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Ошибка загрузки конфигурации: {e}")
        
        return {"target_artists": []}
    
    def init_database(self):
        """Инициализирует базу данных"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS artist_playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist_url TEXT,
                artist_name TEXT,
                playlist_name TEXT,
                playlist_url TEXT,
                playlist_cover_url TEXT,
                playlist_id TEXT,
                owner_id TEXT,
                parsed_at TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def setup_driver(self):
        """Настраивает WebDriver"""
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            print("Chrome WebDriver запущен")
            return True
        except Exception as e:
            print(f"Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def wait_for_content_load(self, timeout=30):
        """Ждет загрузки контента"""
        try:
            print("Ждем загрузки контента...")
            
            # Ждем исчезновения скелетонов
            WebDriverWait(self.driver, timeout).until(
                lambda driver: len(driver.find_elements(By.CSS_SELECTOR, '.Skeleton__playlistContainer')) == 0
            )
            
            print("Скелетоны исчезли, контент загружен")
            return True
            
        except TimeoutException:
            print("Таймаут ожидания загрузки контента")
            return False
        except Exception as e:
            print(f"Ошибка ожидания загрузки: {e}")
            return False
    
    def parse_artist_page(self, artist_url: str) -> List[Dict]:
        """Парсит страницу артиста"""
        try:
            print(f"Переходим на страницу артиста: {artist_url}")
            self.driver.get(artist_url)
            
            # Ждем загрузки страницы
            time.sleep(5)
            
            # Ждем загрузки контента
            if not self.wait_for_content_load():
                print("Контент не загрузился, пробуем парсить то, что есть")
            
            # Извлекаем имя артиста
            artist_name = self.extract_artist_name()
            print(f"Найден артист: {artist_name}")
            
            # Ищем плейлисты
            playlists = self.find_playlists_on_page()
            
            if playlists:
                print(f"Найдено {len(playlists)} плейлистов")
                self.save_playlists_to_db(playlists, artist_url, artist_name)
                return playlists
            else:
                print("Плейлисты не найдены")
                return []
                
        except Exception as e:
            print(f"Ошибка парсинга артиста {artist_url}: {e}")
            return []
    
    def extract_artist_name(self) -> str:
        """Извлекает имя артиста"""
        try:
            selectors = ['h1', '.audio_page_title', '.artist_name', 'title']
            
            for selector in selectors:
                try:
                    element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    text = element.text.strip()
                    if text and len(text) > 1:
                        return text
                except NoSuchElementException:
                    continue
            
            return "Unknown Artist"
            
        except Exception as e:
            print(f"Ошибка извлечения имени артиста: {e}")
            return "Unknown Artist"
    
    def find_playlists_on_page(self) -> List[Dict]:
        """Ищет плейлисты на странице"""
        try:
            playlists = []
            
            print("Ищем плейлисты...")
            
            # Ждем появления блока с плейлистами артиста
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists.CatalogBlock__layout--large_slider'))
                )
            except TimeoutException:
                print("Блок с плейлистами артиста не найден на странице")
                return []
            
            # Ищем элементы галереи плейлистов только внутри блока с плейлистами артиста
            playlist_block = self.driver.find_element(By.CSS_SELECTOR, '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists.CatalogBlock__layout--large_slider')
            gallery_items = playlist_block.find_elements(By.CSS_SELECTOR, '.ui_gallery_item')
            print(f"Найдено {len(gallery_items)} элементов галереи")
            
            for i, item in enumerate(gallery_items):
                try:
                    print(f"\nОбрабатываем элемент галереи {i+1}/{len(gallery_items)}")
                    
                    # Человекоподобное взаимодействие
                    ActionChains(self.driver).move_to_element(item).perform()
                    time.sleep(0.1)
                    
                    # Ищем ссылку на плейлист внутри элемента галереи
                    try:
                        playlist_link = item.find_element(By.CSS_SELECTOR, 'a[href*="/music/playlist/"]')
                        playlist_url = playlist_link.get_attribute('href')
                        print(f"  Найдена ссылка на плейлист: {playlist_url}")
                    except NoSuchElementException:
                        print("  Ссылка на плейлист не найдена в этом элементе")
                        continue
                    
                    # Ищем изображение внутри ссылки
                    try:
                        img = playlist_link.find_element(By.CSS_SELECTOR, 'img')
                        playlist_name = img.get_attribute('alt') or ''
                        playlist_cover_url = img.get_attribute('src') or ''
                        
                        print(f"  Название плейлиста (alt): '{playlist_name}'")
                        print(f"  Обложка плейлиста (src): {playlist_cover_url}")
                        
                    except NoSuchElementException:
                        print("  Изображение не найдено в ссылке")
                        continue
                    
                    # Проверяем, что название не пустое
                    if not playlist_name or len(playlist_name.strip()) < 2:
                        print(f"  Пропускаем плейлист с пустым/коротким названием: '{playlist_name}'")
                        continue
                    
                    # Извлекаем ID из URL
                    import re
                    playlist_id = ''
                    owner_id = ''
                    id_match = re.search(r'/music/playlist/(\d+)_(\d+)', playlist_url)
                    if id_match:
                        owner_id = id_match.group(1)
                        playlist_id = id_match.group(2)
                    
                    playlist_data = {
                        'playlist_name': playlist_name.strip(),
                        'playlist_url': playlist_url,
                        'playlist_cover_url': playlist_cover_url,
                        'playlist_id': playlist_id,
                        'owner_id': owner_id
                    }
                    
                    playlists.append(playlist_data)
                    print(f"  ✅ Добавлен плейлист {len(playlists)}: '{playlist_data['playlist_name']}'")
                        
                except Exception as e:
                    print(f"  ❌ Ошибка обработки элемента галереи {i+1}: {e}")
                    continue
            
            print(f"\nВсего найдено плейлистов: {len(playlists)}")
            return playlists
            
        except Exception as e:
            print(f"Ошибка поиска плейлистов: {e}")
            return []
    
    def save_playlists_to_db(self, playlists: List[Dict], artist_url: str, artist_name: str):
        """Сохраняет плейлисты в базу данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for playlist in playlists:
                # Проверяем, существует ли уже плейлист с таким названием и артистом
                cursor.execute('''
                    SELECT id FROM artist_playlists 
                    WHERE playlist_name = ? AND artist_name = ?
                ''', (playlist['playlist_name'], artist_name))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Обновляем существующий плейлист
                    cursor.execute('''
                        UPDATE artist_playlists 
                        SET artist_url = ?, playlist_url = ?, playlist_cover_url = ?, 
                            playlist_id = ?, owner_id = ?, parsed_at = ?
                        WHERE playlist_name = ? AND artist_name = ?
                    ''', (
                        artist_url,
                        playlist['playlist_url'],
                        playlist['playlist_cover_url'],
                        playlist['playlist_id'],
                        playlist['owner_id'],
                        datetime.now(),
                        playlist['playlist_name'],
                        artist_name
                    ))
                    print(f"  Обновлен существующий плейлист: {playlist['playlist_name']}")
                else:
                    # Создаем новый плейлист
                    cursor.execute('''
                        INSERT INTO artist_playlists 
                        (artist_url, artist_name, playlist_name, playlist_url, playlist_cover_url, playlist_id, owner_id, parsed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        artist_url,
                        artist_name,
                        playlist['playlist_name'],
                        playlist['playlist_url'],
                        playlist['playlist_cover_url'],
                        playlist['playlist_id'],
                        playlist['owner_id'],
                        datetime.now()
                    ))
                    print(f"  Добавлен новый плейлист: {playlist['playlist_name']}")
            
            conn.commit()
            conn.close()
            
            print(f"Сохранено {len(playlists)} плейлистов в базу данных")
            
        except Exception as e:
            print(f"Ошибка сохранения в БД: {e}")
    
    def clear_old_results(self):
        """Очищает старые результаты из базы данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute('DELETE FROM artist_playlists')
            conn.commit()
            conn.close()
            print("Старые результаты очищены из базы данных")
        except Exception as e:
            print(f"Ошибка очистки базы данных: {e}")

    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("Запуск VK парсера")
        
        if not self.setup_driver():
            return False
        
        try:
            for i, artist_url in enumerate(self.config.get('target_artists', []), 1):
                print(f"\nАртист {i}/{len(self.config['target_artists'])}: {artist_url}")
                
                playlists = self.parse_artist_page(artist_url)
                
                if playlists:
                    # Выводим результаты
                    print(f"\nНайдено {len(playlists)} плейлистов:")
                    for j, playlist in enumerate(playlists, 1):
                        print(f"  {j}. {playlist['playlist_name']}")
                        if playlist['playlist_cover_url']:
                            print(f"     Обложка: {playlist['playlist_cover_url']}")
                        print(f"     Ссылка: {playlist['playlist_url']}")
                        print()
                else:
                    print(f"Плейлисты не найдены для {artist_url}")
                
                # Задержка между запросами
                if i < len(self.config['target_artists']):
                    delay = random.uniform(10, 20)
                    print(f"Ждем {delay:.1f} секунд перед следующим артистом...")
                    time.sleep(delay)
            
            return True
        
        finally:
            self.driver.quit()
            print("WebDriver закрыт")
    
    def __del__(self):
        """Деструктор для закрытия WebDriver"""
        if hasattr(self, 'driver') and self.driver:
            self.driver.quit()

def main():
    """Главная функция"""
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("VK Parser")
    print("=" * 50)
    
    parser = VKParser(config_file)
    
    # Проверяем конфигурацию
    if not parser.config.get('target_artists'):
        print("Список артистов не настроен!")
        return False
    
    print("Конфигурация загружена")
    print(f"Целевых артистов: {len(parser.config['target_artists'])}")
    
    # Запускаем парсинг
    try:
        success = parser.run_parsing_cycle()
        return success
    except KeyboardInterrupt:
        print("\nПарсинг прерван пользователем")
        return False
    except Exception as e:
        print(f"\nОшибка: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
