#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser - Интегрированный парсер для системы
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
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

class BandlinkParser:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists.db'
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
            CREATE TABLE IF NOT EXISTS bandlink_playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                artist_name TEXT,
                playlist_name TEXT,
                playlist_artist TEXT,
                track_names TEXT,
                likes_count TEXT,
                platform TEXT,
                playlist_cover_url TEXT,
                playlist_url TEXT,
                parsed_at TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def setup_clean_driver(self):
        """Настраивает чистый WebDriver"""
        chrome_options = Options()
        
        # Базовые настройки стелса
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Настройки для обхода защиты
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--allow-running-insecure-content')
        
        # Настройки окна
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--start-maximized')
        
        # User-Agent
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            
            # Удаляем признаки автоматизации
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
            self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en']})")
            
            print("Чистый Chrome WebDriver запущен")
            return True
        except Exception as e:
            print(f"Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def human_like_behavior(self):
        """Имитирует человеческое поведение"""
        try:
            # Случайные движения мыши
            actions = ActionChains(self.driver)
            for _ in range(random.randint(3, 8)):
                x = random.randint(100, 1800)
                y = random.randint(100, 1000)
                actions.move_by_offset(x, y)
                time.sleep(random.uniform(0.1, 0.3))
            actions.perform()
            
            # Случайная прокрутка
            scroll_amount = random.randint(200, 600)
            self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
            time.sleep(random.uniform(1, 2))
            
            # Случайная задержка
            time.sleep(random.uniform(2, 4))
            
        except Exception as e:
            print(f"Ошибка имитации поведения: {e}")
    
    def navigate_to_scanner(self):
        """Переходит на страницу сканера"""
        try:
            print("Переходим на band.link/scanner...")
            self.driver.get('https://band.link/scanner')
            time.sleep(random.uniform(3, 6))
            
            # Имитируем человеческое поведение
            self.human_like_behavior()
            
            print("Страница загружена")
            return True
                
        except Exception as e:
            print(f"Ошибка перехода на страницу: {e}")
            return False
    
    def search_artist(self, artist_name: str) -> bool:
        """Ищет артиста на странице"""
        try:
            print(f"Ищем артиста: {artist_name}")
            
            # Ищем поле поиска
            search_input = WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder*="Имя артиста"], input[placeholder*="название трека"]'))
            )
            
            # ОЧИЩАЕМ поле полностью
            search_input.clear()
            time.sleep(random.uniform(0.5, 1))
            
            # Выделяем весь текст и удаляем
            search_input.send_keys(Keys.CONTROL + "a")
            time.sleep(random.uniform(0.2, 0.5))
            search_input.send_keys(Keys.DELETE)
            time.sleep(random.uniform(0.5, 1))
            
            # Вводим новый текст посимвольно
            for char in artist_name:
                search_input.send_keys(char)
                time.sleep(random.uniform(0.1, 0.3))
            
            time.sleep(random.uniform(1, 2))
            
            # Нажимаем Enter
            search_input.send_keys(Keys.RETURN)
            
            # Ждем загрузки результатов
            time.sleep(random.uniform(5, 10))
            
            # Имитируем человеческое поведение
            self.human_like_behavior()
            
            return True
            
        except Exception as e:
            print(f"Ошибка поиска артиста: {e}")
            return False
    
    def parse_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты из первого article элемента на странице"""
        try:
            playlists = []
            
            print("Ищем первый article элемент...")
            
            # Ждем появления результатов
            time.sleep(random.uniform(3, 6))
            
            # Ищем первый article элемент
            article = self.driver.find_element(By.CSS_SELECTOR, 'article')
            print("Найден article элемент")
            
            # Ищем кнопку "Показать все" или "Смотреть все" в article
            button_clicked = False
            try:
                # Ищем по data-testid="load-more-button"
                show_all_buttons = article.find_elements(By.CSS_SELECTOR, '[data-testid="load-more-button"]')
                if not show_all_buttons:
                    # Если не найдено по data-testid, ищем по тексту
                    show_all_buttons = article.find_elements(By.CSS_SELECTOR, 'button, div[class*="cardMore"]')
                
                for button in show_all_buttons:
                    button_text = button.text.lower().strip()
                    if ("показать" in button_text or "смотреть" in button_text) and "все" in button_text:
                        if button.is_displayed():
                            print(f"Найдена кнопка '{button.text}', нажимаем...")
                            # Прокручиваем к кнопке перед нажатием
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
                            time.sleep(1)  # Даем время на прокрутку
                            # Пробуем нажать кнопку через JavaScript если обычный клик не работает
                            try:
                                button.click()
                            except Exception as click_error:
                                print(f"Обычный клик не сработал: {click_error}")
                                print("Пробуем клик через JavaScript...")
                                self.driver.execute_script("arguments[0].click();", button)
                            
                            button_clicked = True
                            print("Кнопка нажата, ждем загрузки...")
                            time.sleep(random.uniform(3, 5))  # Ждем загрузки дополнительных плейлистов
                            break
                if not button_clicked:
                    print("Кнопка 'Показать все' не найдена")
            except Exception as e:
                print(f"Ошибка с кнопкой 'Показать все': {e}")
            
            # Прокручиваем страницу только если кнопка была нажата
            if button_clicked:
                print("Прокручиваем страницу для загрузки всех плейлистов...")
                self.scroll_to_load_all_playlists()
            else:
                print("Кнопка не была нажата, прокрутка не нужна")
            
            # Сначала ищем первый элемент с классом card_artistType
            try:
                artist_type_container = article.find_element(By.CSS_SELECTOR, 'div[class*="card_artistType"]')
                print("Найден первый контейнер с классом card_artistType")
                
                # Внутри него ищем все card_horizontalContainer
                playlist_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_horizontalContainer"]')
                print(f"Найдено {len(playlist_containers)} контейнеров плейлистов в первом card_artistType")
            except NoSuchElementException:
                print("Не найден контейнер с классом card_artistType")
                playlist_containers = []
            
            seen_playlists = set()  # Для отслеживания уникальных плейлистов
            
            for container in playlist_containers:
                playlist_data = self.extract_playlist_data_from_container(container, artist_name)
                if playlist_data:
                    # Создаем уникальный ключ на основе названия и ссылки
                    playlist_key = f"{playlist_data['playlist_name']}_{playlist_data['playlist_url']}"
                    if playlist_key not in seen_playlists:
                        playlists.append(playlist_data)
                        seen_playlists.add(playlist_key)
                        print(f"  Добавлен плейлист: {playlist_data['playlist_name']}")
                    else:
                        print(f"  Пропущен дубликат: {playlist_data['playlist_name']}")
            
            return playlists
            
        except Exception as e:
            print(f"Ошибка поиска плейлистов: {e}")
            return []
    
    def scroll_to_load_all_playlists(self):
        """Прокручивает страницу для загрузки всех плейлистов"""
        try:
            # Получаем начальную высоту страницы
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            scroll_attempts = 0
            max_scroll_attempts = 5
            
            while scroll_attempts < max_scroll_attempts:
                # Прокручиваем вниз
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(random.uniform(2, 4))  # Ждем загрузки контента
                
                # Проверяем, увеличилась ли высота страницы
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    print("Достигнут конец страницы, больше контента нет")
                    break
                else:
                    print(f"Высота страницы увеличилась с {last_height} до {new_height}")
                    last_height = new_height
                
                scroll_attempts += 1
            
            # Прокручиваем обратно вверх для лучшего парсинга
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            
        except Exception as e:
            print(f"Ошибка при прокрутке страницы: {e}")

    def extract_playlist_data_from_container(self, container, artist_name: str) -> Optional[Dict]:
        """Извлекает данные плейлиста из контейнера с правильными селекторами"""
        try:
            playlist_data = {
                'artist_name': artist_name,
                'playlist_name': '',
                'playlist_artist': '',
                'track_names': '',
                'likes_count': '',
                'platform': '',
                'playlist_cover_url': '',
                'playlist_url': ''
            }
            
            # Ищем название плейлиста по частичному совпадению класса
            try:
                title_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTitle"], [data-testid="playlist-title"]')
                playlist_data['playlist_name'] = title_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем название трека по частичному совпадению класса
            try:
                track_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackTitle"]')
                playlist_data['track_names'] = track_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем никнеймы исполнителей по частичному совпадению класса
            try:
                artists_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackArtists"], [data-testid="track-info"]')
                playlist_data['playlist_artist'] = artists_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем ссылку на плейлист
            try:
                link_element = container.find_element(By.CSS_SELECTOR, 'a[href], [data-testid="playlist-link"]')
                playlist_data['playlist_url'] = link_element.get_attribute('href')
            except NoSuchElementException:
                pass
            
            # Ищем ссылку на картинку по частичному совпадению класса
            try:
                cover_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionCover"] img, [data-testid="playlist-cover"] img')
                playlist_data['playlist_cover_url'] = cover_element.get_attribute('src')
            except NoSuchElementException:
                pass
            
            # Ищем количество лайков
            try:
                likes_element = container.find_element(By.CSS_SELECTOR, '[class*="like"], [class*="heart"], [data-testid="playlist-likes"]')
                playlist_data['likes_count'] = likes_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Определяем платформу по URL
            if playlist_data['playlist_url']:
                if 'music.mts.ru' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'МТС Музыка'
                elif 'music.yandex.ru' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'Яндекс Музыка'
                else:
                    playlist_data['platform'] = 'Неизвестная платформа'
            else:
                # Если URL не найден, пытаемся найти по тексту
                try:
                    platform_element = container.find_element(By.CSS_SELECTOR, '[class*="platform"], [class*="source"]')
                    playlist_data['platform'] = platform_element.text.strip()
                except NoSuchElementException:
                    playlist_data['platform'] = 'Платформа не определена'
            
            # Проверяем, что нашли хотя бы название плейлиста
            if playlist_data['playlist_name']:
                return playlist_data
            
            return None
            
        except Exception as e:
            print(f"Ошибка извлечения данных плейлиста: {e}")
            return None
    
    def save_playlists_to_db(self, playlists: List[Dict], artist_name: str):
        """Сохраняет плейлисты в базу данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for playlist in playlists:
                # Проверяем, существует ли уже плейлист с таким названием и артистом
                cursor.execute('''
                    SELECT id FROM bandlink_playlists 
                    WHERE playlist_name = ? AND artist_name = ?
                ''', (playlist['playlist_name'], playlist['artist_name']))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Обновляем существующий плейлист
                    cursor.execute('''
                        UPDATE bandlink_playlists 
                        SET playlist_artist = ?, track_names = ?, likes_count = ?, 
                            platform = ?, playlist_cover_url = ?, playlist_url = ?, parsed_at = ?
                        WHERE playlist_name = ? AND artist_name = ?
                    ''', (
                        playlist['playlist_artist'],
                        playlist.get('track_names', ''),
                        playlist['likes_count'],
                        playlist['platform'],
                        playlist['playlist_cover_url'],
                        playlist.get('playlist_url', ''),
                        datetime.now(),
                        playlist['playlist_name'],
                        playlist['artist_name']
                    ))
                    print(f"  Обновлен существующий плейлист: {playlist['playlist_name']}")
                else:
                    # Создаем новый плейлист
                    cursor.execute('''
                        INSERT INTO bandlink_playlists 
                        (artist_name, playlist_name, playlist_artist, track_names, likes_count, platform, playlist_cover_url, playlist_url, parsed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        playlist['artist_name'],
                        playlist['playlist_name'],
                        playlist['playlist_artist'],
                        playlist.get('track_names', ''),
                        playlist['likes_count'],
                        playlist['platform'],
                        playlist['playlist_cover_url'],
                        playlist.get('playlist_url', ''),
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
            cursor.execute('DELETE FROM bandlink_playlists')
            conn.commit()
            conn.close()
            print("Старые результаты очищены из базы данных")
        except Exception as e:
            print(f"Ошибка очистки базы данных: {e}")

    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("Запуск Bandlink парсера")
        
        if not self.setup_clean_driver():
            return False
        
        if not self.navigate_to_scanner():
            print("Ошибка перехода на страницу")
            self.driver.quit()
            return False
        
        try:
            for i, artist_name in enumerate(self.config.get('target_artists', []), 1):
                print(f"\nАртист {i}/{len(self.config['target_artists'])}: {artist_name}")
                
                # Ищем артиста
                if not self.search_artist(artist_name):
                    print(f"Не удалось найти артиста: {artist_name}")
                    continue
                
                # Парсим плейлисты ТОЛЬКО из первой секции
                playlists = self.parse_playlists(artist_name)
                
                if playlists:
                    print(f"Найдено {len(playlists)} уникальных плейлистов")
                    self.save_playlists_to_db(playlists, artist_name)
                    
                    # Выводим результаты (с обработкой Unicode)
                    print(f"\nНайдено {len(playlists)} плейлистов:")
                    for j, playlist in enumerate(playlists, 1):
                        try:
                            # Заменяем специальные символы на обычные пробелы
                            safe_name = playlist['playlist_name'].encode('ascii', 'replace').decode('ascii')
                            print(f"  {j}. {safe_name}")
                            if playlist['playlist_artist']:
                                safe_artist = playlist['playlist_artist'].encode('ascii', 'replace').decode('ascii')
                                print(f"     Артист: {safe_artist}")
                            if playlist.get('track_names'):
                                safe_tracks = playlist['track_names'].encode('ascii', 'replace').decode('ascii')
                                print(f"     Треки: {safe_tracks}")
                            if playlist['likes_count']:
                                print(f"     Лайки: {playlist['likes_count']}")
                            if playlist['platform']:
                                print(f"     Платформа: {playlist['platform']}")
                            if playlist['playlist_cover_url']:
                                print(f"     Обложка: {playlist['playlist_cover_url'][:80]}...")
                            if playlist.get('playlist_url'):
                                print(f"     Ссылка: {playlist['playlist_url']}")
                            print()
                        except Exception as e:
                            print(f"  {j}. [Ошибка вывода: {e}]")
                else:
                    print(f"Плейлисты не найдены для {artist_name}")
                
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
    
    print("Bandlink Parser")
    print("=" * 50)
    
    parser = BandlinkParser(config_file)
    
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
