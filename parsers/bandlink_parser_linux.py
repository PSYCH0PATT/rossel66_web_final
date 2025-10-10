#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Linux - версия с headless режимом
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
        """Настраивает чистый WebDriver для Linux (headless режим)"""
        chrome_options = Options()
        
        # Путь к Chromium в Docker контейнере (Alpine Linux)
        chrome_binary = os.environ.get('CHROME_BIN', '/usr/bin/chromium-browser')
        if os.path.exists(chrome_binary):
            chrome_options.binary_location = chrome_binary
        
        # HEADLESS режим для Linux
        chrome_options.add_argument('--headless=new')
        
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
        chrome_options.add_argument('--disable-software-rasterizer')
        
        # Настройки окна
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--start-maximized')
        
        # User-Agent для Linux
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            
            # Удаляем признаки автоматизации
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
            self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en']})")
            
            print("Чистый Chrome WebDriver запущен (headless режим)")
            return True
        except Exception as e:
            print(f"Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def human_like_behavior(self):
        """Имитирует человеческое поведение (без движений мыши для headless режима)"""
        try:
            # Отключены движения мыши для headless режима (вызывают ошибки)
            # Только скроллинг и задержки
            
            # Случайная прокрутка
            scroll_amount = random.randint(200, 600)
            self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
            time.sleep(random.uniform(1, 2))
            
            # Случайная задержка
            time.sleep(random.uniform(3, 5))
            
        except Exception as e:
            print(f"Ошибка имитации поведения: {e}")
    
    def navigate_to_scanner(self):
        """Переходит на страницу сканера"""
        try:
            print("Переходим на band.link/scanner...")
            self.driver.get('https://band.link/scanner')
            time.sleep(random.uniform(3, 6))
            
            # Логирование текущего URL
            current_url = self.driver.current_url
            print(f"📍 Текущий URL после перехода: {current_url}")
            
            # Логирование заголовка страницы
            page_title = self.driver.title
            print(f"📄 Заголовок страницы: {page_title}")
            
            # Имитируем человеческое поведение
            self.human_like_behavior()
            
            print("✅ Страница загружена успешно")
            return True
                
        except Exception as e:
            print(f"❌ Ошибка перехода на страницу: {e}")
            return False
    
    def search_artist(self, artist_name: str) -> bool:
        """Ищет артиста на странице"""
        try:
            print(f"\n🔍 ===== НАЧАЛО ПОИСКА АРТИСТА: {artist_name} =====")
            
            # Логируем текущий URL перед поиском
            print(f"📍 Текущий URL перед поиском: {self.driver.current_url}")
            
            # Ищем поле поиска
            print("🔎 Ищем поле поиска...")
            try:
                search_input = WebDriverWait(self.driver, 15).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder*="Имя артиста"], input[placeholder*="название трека"]'))
                )
                print("✅ Поле поиска найдено")
                print(f"📝 Placeholder поля: {search_input.get_attribute('placeholder')}")
            except TimeoutException:
                print("❌ Таймаут: поле поиска не найдено за 15 секунд")
                print(f"📄 HTML страницы (первые 500 символов):")
                print(self.driver.page_source[:500])
                return False
            
            # ОЧИЩАЕМ поле полностью
            print("🧹 Очищаем поле поиска...")
            search_input.clear()
            time.sleep(random.uniform(0.5, 1))
            
            # Выделяем весь текст и удаляем
            search_input.send_keys(Keys.CONTROL + "a")
            time.sleep(random.uniform(0.2, 0.5))
            search_input.send_keys(Keys.DELETE)
            time.sleep(random.uniform(0.5, 1))
            print("✅ Поле очищено")
            
            # Вводим новый текст посимвольно
            print(f"⌨️  Вводим текст: '{artist_name}'...")
            for char in artist_name:
                search_input.send_keys(char)
                time.sleep(random.uniform(0.1, 0.3))
            
            # Проверяем введенное значение
            entered_value = search_input.get_attribute('value')
            print(f"✅ Введено: '{entered_value}'")
            
            if entered_value != artist_name:
                print(f"⚠️  ВНИМАНИЕ: Введенное значение не совпадает с именем артиста!")
            
            time.sleep(random.uniform(1, 2))
            
            # Нажимаем Enter
            print("⏎ Нажимаем Enter для поиска...")
            search_input.send_keys(Keys.RETURN)
            print("✅ Enter нажат")
            
            # Логируем URL после нажатия
            time.sleep(2)
            print(f"📍 URL после нажатия Enter: {self.driver.current_url}")
            
            # Ждем загрузки результатов (увеличено для headless режима)
            wait_time = random.uniform(8, 15)
            print(f"⏳ Ждем загрузки результатов ({wait_time:.1f} секунд)...")
            time.sleep(wait_time)
            
            # Логируем после ожидания
            print(f"📍 URL после ожидания: {self.driver.current_url}")
            print(f"📄 Заголовок страницы: {self.driver.title}")
            
            # Имитируем человеческое поведение
            print("🤖 Имитируем человеческое поведение...")
            self.human_like_behavior()
            
            print("✅ Поиск завершен успешно\n")
            return True
            
        except Exception as e:
            print(f"❌ ОШИБКА поиска артиста: {e}")
            print(f"📍 URL при ошибке: {self.driver.current_url}")
            import traceback
            print(f"🔍 Полная трассировка:\n{traceback.format_exc()}")
            return False
    
    def parse_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты из первого article элемента на странице"""
        try:
            playlists = []
            
            print("\n📋 ===== НАЧАЛО ПАРСИНГА ПЛЕЙЛИСТОВ =====")
            print(f"🎵 Артист: {artist_name}")
            print(f"📍 Текущий URL: {self.driver.current_url}")
            
            # Ждем появления результатов (увеличено для headless режима)
            wait_time = random.uniform(5, 10)
            print(f"⏳ Ждем появления результатов ({wait_time:.1f} секунд)...")
            time.sleep(wait_time)
            
            # Логируем HTML страницы перед поиском (первые 1000 символов)
            print("📄 HTML страницы (первые 1000 символов):")
            page_html = self.driver.page_source
            print(page_html[:1000])
            print(f"📊 Общая длина HTML: {len(page_html)} символов")
            
            # Проверяем наличие различных элементов на странице
            print("\n🔍 Проверка наличия элементов:")
            articles_count = len(self.driver.find_elements(By.CSS_SELECTOR, 'article'))
            print(f"   - article элементов: {articles_count}")
            
            divs_count = len(self.driver.find_elements(By.CSS_SELECTOR, 'div'))
            print(f"   - div элементов: {divs_count}")
            
            card_elements = len(self.driver.find_elements(By.CSS_SELECTOR, '[class*="card"]'))
            print(f"   - элементов с 'card' в классе: {card_elements}")
            
            # Используем WebDriverWait для более надежного ожидания
            print("\n🔎 Ищем article элемент...")
            try:
                wait = WebDriverWait(self.driver, 30)  # Увеличен таймаут до 30 секунд
                article = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'article')))
                print("✅ Найден article элемент")
                print(f"📏 Размер article: {article.size}")
                print(f"📍 Позиция article: {article.location}")
                print(f"📝 Первые 500 символов article.text:")
                print(article.text[:500])
            except TimeoutException:
                print("❌ Таймаут ожидания article элемента за 30 секунд")
                print("🔍 Пробуем найти альтернативные элементы...")
                try:
                    # Пытаемся найти контейнер с результатами
                    article = self.driver.find_element(By.CSS_SELECTOR, '[data-testid="search-results"], .search-results, main')
                    print("✅ Найден альтернативный контейнер результатов")
                    print(f"📝 Тег контейнера: {article.tag_name}")
                    print(f"📝 Первые 500 символов text:")
                    print(article.text[:500])
                except NoSuchElementException:
                    print("❌ Не найден ни один контейнер с результатами")
                    print("📄 Сохраняем полный HTML в лог...")
                    print(f"FULL HTML:\n{page_html}")
                    return []
            
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
            print("\n🎯 Ищем контейнер с плейлистами (card_artistType)...")
            try:
                artist_type_container = article.find_element(By.CSS_SELECTOR, 'div[class*="card_artistType"]')
                print("✅ Найден первый контейнер с классом card_artistType")
                print(f"📝 Класс контейнера: {artist_type_container.get_attribute('class')}")
                print(f"📏 Размер контейнера: {artist_type_container.size}")
                
                # Внутри него ищем все card_horizontalContainer
                playlist_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_horizontalContainer"]')
                print(f"✅ Найдено {len(playlist_containers)} контейнеров плейлистов в первом card_artistType")
                
                if len(playlist_containers) == 0:
                    print("⚠️  Контейнеры плейлистов не найдены!")
                    print("📄 HTML контейнера artist_type (первые 1000 символов):")
                    print(artist_type_container.get_attribute('innerHTML')[:1000])
            except NoSuchElementException:
                print("❌ Не найден контейнер с классом card_artistType")
                print("🔍 Проверяем наличие других контейнеров...")
                
                all_card_types = article.find_elements(By.CSS_SELECTOR, '[class*="card"]')
                print(f"   Найдено элементов с 'card' в классе: {len(all_card_types)}")
                
                if len(all_card_types) > 0:
                    print("   Классы первых 5 элементов:")
                    for i, elem in enumerate(all_card_types[:5]):
                        print(f"     {i+1}. {elem.get_attribute('class')}")
                
                playlist_containers = []
            
            seen_playlists = set()  # Для отслеживания уникальных плейлистов
            
            print(f"\n📦 Обрабатываем {len(playlist_containers)} контейнеров...")
            for i, container in enumerate(playlist_containers, 1):
                print(f"\n   Контейнер {i}/{len(playlist_containers)}:")
                playlist_data = self.extract_playlist_data_from_container(container, artist_name)
                if playlist_data:
                    # Создаем уникальный ключ на основе названия и ссылки
                    playlist_key = f"{playlist_data['playlist_name']}_{playlist_data['playlist_url']}"
                    if playlist_key not in seen_playlists:
                        playlists.append(playlist_data)
                        seen_playlists.add(playlist_key)
                        print(f"   ✅ Добавлен плейлист: {playlist_data['playlist_name']}")
                        print(f"      Платформа: {playlist_data['platform']}")
                        print(f"      URL: {playlist_data['playlist_url'][:50]}...")
                    else:
                        print(f"   ⚠️  Пропущен дубликат: {playlist_data['playlist_name']}")
                else:
                    print(f"   ❌ Не удалось извлечь данные из контейнера")
            
            print(f"\n📊 ===== ИТОГ ПАРСИНГА =====")
            print(f"   Найдено уникальных плейлистов: {len(playlists)}")
            print(f"   Обработано контейнеров: {len(playlist_containers)}")
            
            if len(playlists) == 0:
                print("   ❌ АРТИСТ НЕ НАЙДЕН: плейлисты не обнаружены")
            else:
                print("   ✅ АРТИСТ НАЙДЕН: плейлисты успешно извлечены")
            
            print("=" * 50 + "\n")
            
            return playlists
            
        except Exception as e:
            print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА поиска плейлистов: {e}")
            import traceback
            print(f"🔍 Полная трассировка:\n{traceback.format_exc()}")
            print(f"📍 URL при ошибке: {self.driver.current_url}")
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
            
            print(f"      🔍 Извлечение данных из контейнера...")
            print(f"      📝 Класс контейнера: {container.get_attribute('class')}")
            
            # Ищем название плейлиста по частичному совпадению класса
            try:
                title_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTitle"], [data-testid="playlist-title"]')
                playlist_data['playlist_name'] = title_element.text.strip()
                print(f"      ✅ Название: {playlist_data['playlist_name']}")
            except NoSuchElementException:
                print(f"      ❌ Название плейлиста не найдено")
            
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
                print(f"      ✅ Данные извлечены успешно")
                return playlist_data
            else:
                print(f"      ⚠️  Название плейлиста не найдено, данные не будут использованы")
                print(f"      📄 HTML контейнера (первые 300 символов):")
                print(f"      {container.get_attribute('innerHTML')[:300]}")
            
            return None
            
        except Exception as e:
            print(f"      ❌ Ошибка извлечения данных плейлиста: {e}")
            import traceback
            print(f"      🔍 Трассировка: {traceback.format_exc()}")
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

    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("Запуск Bandlink парсера для Linux (headless режим)")
        
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
                    
                    # Выводим результаты (с обработкой Unicode для Linux)
                    print(f"\nНайдено {len(playlists)} плейлистов:")
                    for j, playlist in enumerate(playlists, 1):
                        print(f"  {j}. {playlist['playlist_name']}")
                        if playlist['playlist_artist']:
                            print(f"     Артист: {playlist['playlist_artist']}")
                        if playlist.get('track_names'):
                            print(f"     Треки: {playlist['track_names']}")
                        if playlist['likes_count']:
                            print(f"     Лайки: {playlist['likes_count']}")
                        if playlist['platform']:
                            print(f"     Платформа: {playlist['platform']}")
                        print()
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
    
    print("Bandlink Parser для Linux (Headless)")
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

