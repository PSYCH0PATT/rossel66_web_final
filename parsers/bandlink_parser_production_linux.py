#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser Production для Linux - с прокси, куками и человечностью
"""

import json
import time
import random
import os
import sqlite3
import sys
import uuid
from datetime import datetime
from typing import Dict, List, Optional

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ Selenium не установлен. Установите: pip install selenium webdriver-manager")
    sys.exit(1)

# User-Agent ротация
USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

class BandlinkParserProductionLinux:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists.db'
        self.driver = None
        
        # Прокси настройки (не используются на Mac, но сохраняем для совместимости)
        self.proxy_username = self.config.get('bright_data_proxy_username')
        self.proxy_password = self.config.get('bright_data_proxy_password')
        self.proxy_host = self.config.get('proxy_host', 'brd.superproxy.io')
        self.proxy_port = self.config.get('proxy_port', 33335)
        self.max_proxy_attempts = 3
        self.proxy_attempts = 0
        
        # Куки
        self.cookies = self.config.get('cookies', {})
        
        # Капча (на Mac без прокси просто логируем)
        self.captcha_detected_count = 0
        
        self.init_database()
        print(f"✅ Парсер инициализирован (Linux - без прокси)")
        if self.cookies:
            print(f"🍪 Куки загружены: {len(self.cookies)} шт.")
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"❌ Ошибка загрузки конфигурации: {e}")
                return {}
        return {}
    
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
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(artist_name, playlist_name, playlist_url)
                )
            ''')
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"❌ Ошибка инициализации БД: {e}")
    
    def get_random_user_agent(self) -> str:
        """Возвращает случайный User-Agent"""
        return random.choice(USER_AGENTS)
    
    def human_delay(self, min_sec: float = 2, max_sec: float = 5):
        """Человеческая задержка"""
        delay = random.uniform(min_sec, max_sec)
        time.sleep(delay)
    
    def cleanup_chrome_processes(self):
        """Убивает все зависшие процессы Chrome и chromedriver"""
        try:
            import subprocess
            print("🧹 Очистка зависших процессов Chrome...")
            
            # Проверяем сколько процессов chrome запущено
            try:
                result = subprocess.run(['ps', 'aux'], 
                                      capture_output=True, 
                                      text=True)
                chrome_count = result.stdout.count('chrome')
                print(f"  📊 Найдено процессов chrome: {chrome_count}")
            except:
                pass
            
            # Убиваем все процессы chrome НЕСКОЛЬКО РАЗ
            for i in range(3):
                try:
                    subprocess.run(['pkill', '-9', 'chrome'], 
                                 stderr=subprocess.DEVNULL, 
                                 stdout=subprocess.DEVNULL,
                                 timeout=5)
                    subprocess.run(['killall', '-9', 'chrome'], 
                                 stderr=subprocess.DEVNULL, 
                                 stdout=subprocess.DEVNULL,
                                 timeout=5)
                except:
                    pass
                time.sleep(1)
            
            # Убиваем все процессы chromedriver
            for i in range(3):
                try:
                    subprocess.run(['pkill', '-9', 'chromedriver'], 
                                 stderr=subprocess.DEVNULL, 
                                 stdout=subprocess.DEVNULL,
                                 timeout=5)
                    subprocess.run(['killall', '-9', 'chromedriver'], 
                                 stderr=subprocess.DEVNULL, 
                                 stdout=subprocess.DEVNULL,
                                 timeout=5)
                except:
                    pass
                time.sleep(1)
            
            print("  ✓ Команды остановки отправлены")
            
            # Очищаем временные директории Chrome
            try:
                import glob
                import shutil
                temp_dirs = glob.glob('/tmp/chrome_temp_*')
                for temp_dir in temp_dirs:
                    try:
                        shutil.rmtree(temp_dir, ignore_errors=True)
                    except:
                        pass
                if temp_dirs:
                    print(f"  ✓ Удалено {len(temp_dirs)} временных директорий")
            except:
                pass
            
            # Ждем чтобы процессы точно завершились
            time.sleep(3)
            
            # Проверяем снова
            try:
                result = subprocess.run(['ps', 'aux'], 
                                      capture_output=True, 
                                      text=True)
                chrome_count_after = result.stdout.count('chrome')
                print(f"  📊 Осталось процессов chrome: {chrome_count_after}")
            except:
                pass
            
            print("✅ Очистка завершена")
            
        except Exception as e:
            print(f"⚠️  Ошибка очистки процессов: {e}")
    
    def setup_driver(self, use_proxy: bool = True) -> bool:
        """Настраивает Chrome драйвер БЕЗ user-data-dir (как в рабочем bandlink_parser_linux.py)"""
        try:
            print("=" * 60)
            print("🐧 LINUX PARSER - ЧИСТАЯ ВЕРСИЯ БЕЗ USER-DATA-DIR")
            print("=" * 60)
            
            # Очищаем зависшие процессы только при первой попытке
            if self.proxy_attempts == 0:
                self.cleanup_chrome_processes()
            
            self.proxy_attempts += 1
            print(f"🔧 Настройка Chrome драйвера (попытка {self.proxy_attempts}/{self.max_proxy_attempts})...")
            
            options = Options()
            
            # Путь к Chromium в Docker контейнере (Alpine Linux)
            chrome_binary = os.environ.get('CHROME_BIN', '/usr/bin/chromium-browser')
            if os.path.exists(chrome_binary):
                options.binary_location = chrome_binary
                print(f"🌐 Chrome binary: {chrome_binary}")
            
            # HEADLESS режим для Linux
            options.add_argument('--headless=new')
            
            # Базовые настройки стелса (как в bandlink_parser_linux.py)
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Настройки для обхода защиты
            options.add_argument('--disable-extensions')
            options.add_argument('--disable-plugins')
            options.add_argument('--disable-gpu')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-web-security')
            options.add_argument('--allow-running-insecure-content')
            options.add_argument('--disable-software-rasterizer')
            
            # Настройки окна
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--start-maximized')
            
            # User-Agent для Linux
            options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            # НЕ ИСПОЛЬЗУЕМ --user-data-dir ВООБЩЕ!
            # Selenium сам создаст временную директорию и сам её удалит
            print("📁 Selenium использует дефолтное управление профилями")
            
            print("🚀 Запуск Chrome...")
            self.driver = webdriver.Chrome(options=options)
            
            # Удаляем признаки автоматизации
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.execute_script("Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]})")
            self.driver.execute_script("Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en']})")
            
            # Настройка таймаутов
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            print("✅ Chrome драйвер настроен (headless режим)")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка настройки драйвера: {e}")
            
            # Если достигнут лимит попыток
            if self.proxy_attempts >= self.max_proxy_attempts:
                print(f"❌ Достигнут лимит попыток ({self.max_proxy_attempts}). Парсер остановлен.")
                return False
            
            # Повторная попытка
            print(f"🔄 Повторная попытка...")
            self.human_delay(2, 3)
            return self.setup_driver(use_proxy=False)
    
    def add_cookies(self):
        """Добавляет куки в браузер"""
        if not self.cookies:
            print("🍪 Куки не найдены в конфиге")
            return
        
        print(f"🍪 Добавление {len(self.cookies)} кук...")
        try:
            # Сначала переходим на band.link чтобы установить домен
            print("🔗 Переход на https://band.link для добавления кук...")
            self.driver.get("https://band.link")
            self.human_delay(1, 2)
            
            added = 0
            failed = 0
            for name, value in self.cookies.items():
                try:
                    # Пробуем разные варианты domain
                    cookie_data = {
                        'name': name,
                        'value': str(value)
                    }
                    
                    # Пробуем без domain (автоопределение)
                    try:
                        self.driver.add_cookie(cookie_data)
                        added += 1
                        continue
                    except:
                        pass
                    
                    # Пробуем с .band.link
                    cookie_data['domain'] = '.band.link'
                    try:
                        self.driver.add_cookie(cookie_data)
                        added += 1
                        continue
                    except:
                        pass
                    
                    # Пробуем с band.link
                    cookie_data['domain'] = 'band.link'
                    try:
                        self.driver.add_cookie(cookie_data)
                        added += 1
                    except:
                        failed += 1
                        
                except Exception as e:
                    failed += 1
            
            print(f"✅ Добавлено {added} кук (не удалось: {failed})")
        except Exception as e:
            print(f"❌ Ошибка добавления кук: {e}")
    
    def detect_captcha(self) -> bool:
        """Определяет наличие капчи на странице"""
        try:
            current_url = self.driver.current_url
            
            # Проверяем URL на наличие капчи
            if 'captcha' in current_url.lower() or 'robot' in current_url.lower():
                print("🔒 КАПЧА обнаружена в URL!")
                return True
            
            # Ищем iframe с капчей
            iframe_selectors = [
                'iframe[src*="captcha"]',
                'iframe[src*="smartcaptcha"]', 
                'iframe[src*="yandex"]',
                'iframe[src*="recaptcha"]',
                'iframe[id*="captcha"]',
            ]
            
            for selector in iframe_selectors:
                iframes = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if iframes:
                    for iframe in iframes:
                        src = iframe.get_attribute('src') or ''
                        if any(keyword in src.lower() for keyword in ['captcha', 'yandex', 'smartcaptcha', 'recaptcha']):
                            print(f"🔒 КАПЧА обнаружена: iframe {src[:100]}...")
                            return True
            
            # Ищем div-контейнеры капчи
            captcha_divs = self.driver.find_elements(By.CSS_SELECTOR, 'div[class*="captcha"], div[id*="captcha"]')
            if captcha_divs:
                print(f"🔒 КАПЧА обнаружена: {len(captcha_divs)} контейнеров")
                return True
            
            # Проверяем, что есть контент (article)
            try:
                self.driver.find_element(By.CSS_SELECTOR, 'article')
                return False  # Контент есть, капчи нет
            except:
                # Нет контента - возможно капча
                page_text = self.driver.find_element(By.TAG_NAME, 'body').text.lower()
                if any(keyword in page_text for keyword in ['captcha', 'robot', 'проверка', 'verification']):
                    print("🔒 КАПЧА обнаружена в тексте страницы")
                    return True
            
            return False
            
        except Exception as e:
            print(f"⚠️  Ошибка детекции капчи: {e}")
            return False
    
    def navigate_to_artist(self, artist_name: str) -> bool:
        """Переходит напрямую по ссылке на артиста"""
        try:
            # Формируем URL как в примере: https://band.link/scanner?search=sour+diesel
            search_query = artist_name.replace(' ', '+')
            url = f"https://band.link/scanner?search={search_query}"
            
            print(f"🔗 Переход на: {url}")
            self.driver.get(url)
            
            # Человеческая задержка
            self.human_delay(3, 5)
            
            # Проверяем капчу (на Mac просто логируем, т.к. нет прокси для смены)
            if self.detect_captcha():
                self.captcha_detected_count += 1
                print(f"\n{'='*60}")
                print(f"🚨 КАПЧА ОБНАРУЖЕНА (Mac - #{self.captcha_detected_count})")
                print(f"⚠️  На Mac нет прокси для смены IP")
                print(f"💡 Попробуйте позже или используйте Linux парсер")
                print(f"{'='*60}\n")
                return False  # На Mac останавливаемся при капче
            
            # Проверяем, что страница загрузилась
            current_url = self.driver.current_url
            if "band.link" in current_url:
                print(f"✅ Успешно перешли на страницу артиста (без капчи)")
                return True
            else:
                print(f"❌ Не удалось перейти. URL: {current_url}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка навигации: {e}")
            return False
    
    def parse_artist_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты артиста"""
        try:
            print(f"📋 Парсинг плейлистов для: {artist_name}")
            
            playlists = []
            seen_playlists = set()
            
            # Ждем загрузки
            self.human_delay(2, 4)
            
            # Ищем article элемент
            try:
                article = self.driver.find_element(By.CSS_SELECTOR, 'article')
                print("✅ Найден article элемент")
            except NoSuchElementException:
                print("❌ Article элемент не найден!")
                return []
            
            # Ищем кнопку "Показать все"
            try:
                show_all_buttons = article.find_elements(By.CSS_SELECTOR, '[data-testid="load-more-button"], button')
                for button in show_all_buttons:
                    button_text = button.text.lower().strip()
                    if ("показать" in button_text or "смотреть" in button_text) and "все" in button_text:
                        if button.is_displayed():
                            print(f"✅ Нажимаем кнопку: {button.text}")
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
                            self.human_delay(1, 2)
                            
                            try:
                                button.click()
                            except:
                                self.driver.execute_script("arguments[0].click();", button)
                            
                            print("✅ Кнопка нажата, загружаем контент...")
                            self.human_delay(3, 5)
                            self.scroll_to_load_all()
                            break
            except Exception as e:
                print(f"ℹ️  Кнопка 'Показать все' не найдена: {e}")
            
            # Ищем контейнер плейлистов
            try:
                artist_type_container = article.find_element(By.CSS_SELECTOR, 'div[class*="card_artistType"]')
                print("✅ Найден контейнер card_artistType")
                
                # Ищем контейнеры плейлистов
                horizontal_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_horizontalContainer"]')
                vertical_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_verticalContainer"]')
                
                all_containers = horizontal_containers + vertical_containers
                print(f"✅ Найдено {len(all_containers)} контейнеров плейлистов")
                
                for container in all_containers:
                    playlist_data = self.extract_playlist_data(container, artist_name)
                    if playlist_data and playlist_data['playlist_name']:
                        playlist_key = f"{playlist_data['playlist_name']}_{playlist_data.get('playlist_url', '')}"
                        if playlist_key not in seen_playlists:
                            playlists.append(playlist_data)
                            seen_playlists.add(playlist_key)
                            print(f"  ✅ {playlist_data['platform']}: {playlist_data['playlist_name']}")
                
            except NoSuchElementException:
                print("❌ Контейнер card_artistType не найден!")
            
            print(f"🎉 Найдено {len(playlists)} плейлистов")
            return playlists
            
        except Exception as e:
            print(f"❌ Ошибка парсинга: {e}")
            return []
    
    def scroll_to_load_all(self):
        """Прокручивает страницу для загрузки контента"""
        try:
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            attempts = 0
            max_attempts = 5
            
            while attempts < max_attempts:
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                self.human_delay(2, 4)
                
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    break
                last_height = new_height
                attempts += 1
            
            self.driver.execute_script("window.scrollTo(0, 0);")
            self.human_delay(1, 2)
        except Exception as e:
            print(f"⚠️  Ошибка прокрутки: {e}")
    
    def extract_playlist_data(self, container, artist_name: str) -> Optional[Dict]:
        """Извлекает данные плейлиста из контейнера"""
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
            
            # Название плейлиста
            try:
                title_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTitle"]')
                playlist_data['playlist_name'] = title_element.text.strip()
            except:
                pass
            
            # Название трека
            try:
                track_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackTitle"]')
                playlist_data['track_names'] = track_element.text.strip()
            except:
                pass
            
            # Исполнители
            try:
                artists_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackArtists"]')
                playlist_data['playlist_artist'] = artists_element.text.strip()
            except:
                pass
            
            # Ссылка на плейлист
            try:
                link_element = container.find_element(By.CSS_SELECTOR, 'a[href]')
                playlist_url = link_element.get_attribute('href')
                playlist_data['playlist_url'] = playlist_url
                
                # Определяем платформу
                if 'music.mts.ru' in playlist_url:
                    playlist_data['platform'] = 'МТС Музыка'
                elif 'music.yandex.ru' in playlist_url:
                    playlist_data['platform'] = 'Яндекс Музыка'
                elif 'spotify.com' in playlist_url:
                    playlist_data['platform'] = 'Spotify'
                elif 'music.apple.com' in playlist_url:
                    playlist_data['platform'] = 'Apple Music'
                elif 'music.youtube.com' in playlist_url:
                    playlist_data['platform'] = 'YouTube Music'
                elif 'vk.com' in playlist_url:
                    playlist_data['platform'] = 'VK'
                else:
                    playlist_data['platform'] = 'Другая'
            except:
                pass
            
            # Обложка
            try:
                cover_element = container.find_element(By.CSS_SELECTOR, 'img')
                playlist_data['playlist_cover_url'] = cover_element.get_attribute('src')
            except:
                pass
            
            return playlist_data
            
        except Exception as e:
            return None
    
    def save_playlists_to_db(self, playlists: List[Dict]):
        """Сохраняет плейлисты в БД"""
        if not playlists:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            saved_count = 0
            updated_count = 0
            
            for playlist in playlists:
                try:
                    # Проверяем существует ли плейлист
                    cursor.execute('''
                        SELECT id, added_at FROM playlists 
                        WHERE artist_name = ? AND playlist_name = ? AND playlist_url = ?
                    ''', (
                        playlist['artist_name'],
                        playlist['playlist_name'],
                        playlist.get('playlist_url', '')
                    ))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Обновляем существующий плейлист, сохраняя added_at
                        cursor.execute('''
                            UPDATE playlists 
                            SET playlist_artist = ?, track_names = ?, likes_count = ?, 
                                platform = ?, playlist_cover_url = ?, parsed_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        ''', (
                            playlist.get('playlist_artist', ''),
                            playlist.get('track_names', ''),
                            playlist.get('likes_count', ''),
                            playlist.get('platform', ''),
                            playlist.get('playlist_cover_url', ''),
                            existing[0]
                        ))
                        updated_count += 1
                    else:
                        # Добавляем новый плейлист (added_at установится автоматически)
                        cursor.execute('''
                            INSERT INTO playlists 
                            (artist_name, playlist_name, playlist_artist, track_names, 
                             likes_count, platform, playlist_cover_url, playlist_url)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            playlist['artist_name'],
                            playlist['playlist_name'],
                            playlist.get('playlist_artist', ''),
                            playlist.get('track_names', ''),
                            playlist.get('likes_count', ''),
                            playlist.get('platform', ''),
                            playlist.get('playlist_cover_url', ''),
                            playlist.get('playlist_url', '')
                        ))
                        saved_count += 1
                        
                except Exception as e:
                    print(f"⚠️  Ошибка сохранения: {e}")
            
            conn.commit()
            conn.close()
            print(f"💾 Добавлено {saved_count} новых, обновлено {updated_count} плейлистов")
            
        except Exception as e:
            print(f"❌ Ошибка сохранения в БД: {e}")
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("🚀 Запуск Bandlink Parser Production для Mac")
        
        if not self.setup_driver():
            return False
        
        try:
            # Добавляем куки
            self.add_cookies()
            
            # Парсим артистов
            artists = self.config.get('target_artists', [])
            if not artists:
                print("❌ Список артистов пуст!")
                return False
            
            print(f"📋 Парсинг {len(artists)} артистов...")
            
            total_playlists = 0
            for i, artist in enumerate(artists, 1):
                try:
                    print(f"\n{'='*60}")
                    print(f"📍 Артист {i}/{len(artists)}: {artist}")
                    print(f"{'='*60}")
                    
                    # Переходим по прямой ссылке
                    if not self.navigate_to_artist(artist):
                        print(f"❌ Не удалось перейти к артисту: {artist}")
                        continue
                    
                    # Парсим плейлисты
                    playlists = self.parse_artist_playlists(artist)
                    
                    if playlists:
                        self.save_playlists_to_db(playlists)
                        total_playlists += len(playlists)
                        print(f"✅ Обработан артист: {artist}")
                    else:
                        print(f"⚠️  Плейлисты не найдены для: {artist}")
                    
                    # Человеческая задержка между артистами
                    if i < len(artists):
                        self.human_delay(5, 10)
                    
                except Exception as e:
                    print(f"❌ Ошибка обработки артиста {artist}: {e}")
                    continue
            
            print(f"\n{'='*60}")
            print(f"🎉 Парсинг завершен!")
            print(f"📊 Всего найдено: {total_playlists} плейлистов")
            print(f"💾 База данных: {self.db_path}")
            print(f"{'='*60}")
            
            return True
            
        finally:
            if self.driver:
                self.driver.quit()
                print("🔒 Браузер закрыт")

def main():
    """Главная функция"""
    if len(sys.argv) < 2:
        print("❌ Не указан файл конфигурации")
        print("💡 Использование: python3 bandlink_parser_production_mac.py <config.json>")
        sys.exit(1)
    
    config_file = sys.argv[1]
    
    if not os.path.exists(config_file):
        print(f"❌ Конфиг файл не найден: {config_file}")
        sys.exit(1)
    
    print("="*60)
    print("🎵 Bandlink Parser Production для Linux")
    print("="*60)
    print(f"📁 Конфиг: {config_file}\n")
    
    parser = BandlinkParserProductionLinux(config_file)
    success = parser.run_parsing_cycle()
    
    if success:
        print("\n✅ Парсинг завершен успешно!")
    else:
        print("\n❌ Парсинг завершен с ошибками")

if __name__ == "__main__":
    main()

