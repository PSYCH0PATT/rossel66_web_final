#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VK Parser для Linux - с куками, прокси (selenium-wire) и 2captcha
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
    # Используем selenium-wire для работы с прокси с авторизацией
    from seleniumwire import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    import re
    SELENIUM_WIRE_AVAILABLE = True
except ImportError:
    try:
        # Fallback на обычный selenium
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from selenium.common.exceptions import TimeoutException, NoSuchElementException
        import re
        SELENIUM_WIRE_AVAILABLE = False
        print("⚠️  selenium-wire не установлен, прокси с авторизацией может не работать")
    except ImportError:
        print("❌ Selenium не установлен. Установите: pip install selenium selenium-wire")
        sys.exit(1)

try:
    from twocaptcha import TwoCaptcha
    TWOCAPTCHA_AVAILABLE = True
except ImportError:
    print("⚠️ 2captcha-python не установлен. Капчи не будут решаться автоматически.")
    TWOCAPTCHA_AVAILABLE = False

class VKParser:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'vk_playlists.db'
        self.driver = None
        self.captcha_solver = None
        
        # Прокси настройки
        self.proxy_username = self.config.get('proxy_username')
        self.proxy_password = self.config.get('proxy_password')
        self.proxy_host = self.config.get('proxy_host', '94.154.188.161')
        self.proxy_port = self.config.get('proxy_port', 63194)
        
        # Куки
        self.cookies = self.config.get('cookies', {})
        
        self.init_database()
        self.init_captcha_solver()
        
        # Логируем инициализацию
        has_proxy = bool(self.proxy_username and self.proxy_password)
        print(f"✅ VK Парсер инициализирован (Linux - {'с прокси' if has_proxy else 'без прокси'})")
        if self.cookies:
            print(f"🍪 Куки загружены: {len(self.cookies)} шт.")
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Ошибка загрузки конфигурации: {e}")
        
        return {"target_artists": [], "captcha_api_key": None, "cookies": {}}
    
    def init_database(self):
        """Инициализирует базу данных"""
        try:
            # Используем абсолютный путь для надежности
            abs_db_path = os.path.abspath(self.db_path)
            self.db_path = abs_db_path
            
            # Проверяем, существует ли база данных
            db_exists = os.path.exists(abs_db_path)
            
            conn = sqlite3.connect(abs_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS vk_playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artist_url TEXT,
                    artist_name TEXT,
                    playlist_name TEXT,
                    playlist_url TEXT,
                    playlist_cover_url TEXT,
                    playlist_id TEXT,
                    owner_id TEXT,
                    parsed_at TIMESTAMP,
                    UNIQUE(artist_name, playlist_name, playlist_url)
                )
            ''')
            
            # Таблица для VK cookies
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS vk_cookies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cookie_name TEXT NOT NULL UNIQUE,
                    cookie_value TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            
            # Проверяем количество записей в БД
            cursor.execute('SELECT COUNT(*) FROM vk_playlists')
            count = cursor.fetchone()[0]
            
            conn.close()
            
            if db_exists:
                print(f"📦 База данных существует: {abs_db_path} ({count} записей)")
            else:
                print(f"📦 Создана новая база данных: {abs_db_path}")
                
        except Exception as e:
            print(f"❌ Ошибка инициализации БД: {e}")
            import traceback
            traceback.print_exc()
    
    def init_captcha_solver(self):
        """Инициализирует 2captcha solver если API ключ предоставлен"""
        api_key = self.config.get('captcha_api_key')
        
        if api_key and TWOCAPTCHA_AVAILABLE:
            try:
                self.captcha_solver = TwoCaptcha(api_key)
                print(f"✅ 2captcha инициализирован (API ключ: {api_key[:8]}...)")
            except Exception as e:
                print(f"❌ Ошибка инициализации 2captcha: {e}")
                self.captcha_solver = None
        elif api_key and not TWOCAPTCHA_AVAILABLE:
            print("⚠️ API ключ 2captcha предоставлен, но библиотека не установлена!")
        else:
            print("ℹ️  2captcha не настроен. Капчи не будут решаться автоматически.")
    
    def human_delay(self, min_seconds: float = 1, max_seconds: float = 3):
        """Человеческая задержка"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)
    
    def add_cookies(self):
        """Добавляет куки в браузер"""
        if not self.cookies:
            print("🍪 Куки не найдены в конфиге")
            return
        
        print(f"🍪 Добавление {len(self.cookies)} кук...")
        try:
            # Сначала переходим на vk.com чтобы установить домен
            print("🔗 Переход на https://vk.com для добавления кук...")
            self.driver.get("https://vk.com")
            self.human_delay(2, 3)
            
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
                    
                    # Пробуем с .vk.com
                    cookie_data['domain'] = '.vk.com'
                    try:
                        self.driver.add_cookie(cookie_data)
                        added += 1
                        continue
                    except:
                        pass
                    
                    # Пробуем с vk.com
                    cookie_data['domain'] = 'vk.com'
                    try:
                        self.driver.add_cookie(cookie_data)
                        added += 1
                    except:
                        failed += 1
                        
                except Exception as e:
                    failed += 1
            
            print(f"✅ Добавлено {added} кук (не удалось: {failed})")
            
            # Перезагружаем страницу для применения кук
            if added > 0:
                self.driver.refresh()
                self.human_delay(2, 3)
                
        except Exception as e:
            print(f"❌ Ошибка добавления кук: {e}")
    
    def setup_driver(self) -> bool:
        """Настраивает WebDriver для Linux с selenium-wire"""
        try:
            print("=" * 60)
            print("🐧 VK PARSER LINUX" + (" С SELENIUM-WIRE" if SELENIUM_WIRE_AVAILABLE else ""))
            print("=" * 60)
            
            options = Options()
            
            # Путь к Chromium в Docker контейнере
            chrome_binary = os.environ.get('CHROME_BIN', '/usr/bin/chromium-browser')
            if os.path.exists(chrome_binary):
                options.binary_location = chrome_binary
                print(f"🌐 Chrome binary: {chrome_binary}")
            
            # HEADLESS режим для Linux
            options.add_argument('--headless=new')
            
            # Базовые настройки
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-software-rasterizer')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            # Дополнительные опции для стабильности
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Настройка selenium-wire для прокси с авторизацией
            seleniumwire_options = {}
            use_proxy = bool(self.proxy_username and self.proxy_password)
            
            if use_proxy and SELENIUM_WIRE_AVAILABLE:
                proxy_url = f"http://{self.proxy_username}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}"
                seleniumwire_options = {
                    'proxy': {
                        'http': proxy_url,
                        'https': proxy_url,
                        'no_proxy': 'localhost,127.0.0.1'
                    }
                }
                print(f"🌐 Прокси настроен через selenium-wire: {self.proxy_host}:{self.proxy_port}")
                print(f"👤 Username: {self.proxy_username}")
            else:
                print("⚠️  Прокси отключен")
            
            print("🚀 Запуск Chrome...")
            
            # Запускаем Chrome
            try:
                chromium_path = '/usr/bin/chromium-browser'
                chromedriver_path = '/usr/bin/chromedriver'
                
                if os.path.exists(chromium_path):
                    options.binary_location = chromium_path
                
                if os.path.exists(chromedriver_path):
                    service = Service(chromedriver_path)
                    if seleniumwire_options and SELENIUM_WIRE_AVAILABLE:
                        self.driver = webdriver.Chrome(
                            service=service, 
                            options=options,
                            seleniumwire_options=seleniumwire_options
                        )
                    else:
                        self.driver = webdriver.Chrome(service=service, options=options)
                else:
                    if seleniumwire_options and SELENIUM_WIRE_AVAILABLE:
                        self.driver = webdriver.Chrome(
                            options=options,
                            seleniumwire_options=seleniumwire_options
                        )
                    else:
                        self.driver = webdriver.Chrome(options=options)
                        
            except Exception as e:
                print(f"⚠️  Ошибка настройки Service: {e}")
                self.driver = webdriver.Chrome(options=options)
            
            # Удаляем признаки автоматизации
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Настройка таймаутов
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            print("✅ Chrome WebDriver запущен (headless режим)")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def detect_vk_captcha(self) -> Optional[Dict]:
        """Определяет наличие VK капчи на странице и извлекает параметры"""
        try:
            current_url = self.driver.current_url
            if 'captcha.php' in current_url or '/captcha' in current_url:
                print("🔍 Обнаружена VK капча в URL!")
                
                import urllib.parse
                parsed_url = urllib.parse.urlparse(current_url)
                params = urllib.parse.parse_qs(parsed_url.query)
                
                captcha_data = {
                    'sid': params.get('sid', [None])[0],
                    's': params.get('s', [None])[0],
                    'url': current_url
                }
                
                print(f"📋 Параметры капчи: SID={captcha_data['sid']}, S={captcha_data['s']}")
                return captcha_data
            
            # Проверяем наличие iframe с капчей
            captcha_iframes = self.driver.find_elements(By.CSS_SELECTOR, 'iframe[src*="captcha"]')
            if len(captcha_iframes) > 0:
                print("🔍 Обнаружен iframe с VK капчей!")
                iframe_src = captcha_iframes[0].get_attribute('src')
                return {'url': iframe_src}
            
            # Проверяем изображение капчи
            captcha_imgs = self.driver.find_elements(By.CSS_SELECTOR, 'img[src*="captcha"]')
            if len(captcha_imgs) > 0:
                print("🔍 Обнаружено изображение VK капчи!")
                img_src = captcha_imgs[0].get_attribute('src')
                return {'image_url': img_src}
            
            return None
            
        except Exception as e:
            print(f"⚠️ Ошибка детекта VK капчи: {e}")
            return None
    
    def solve_vk_captcha(self, captcha_data: Dict) -> bool:
        """Решает VK капчу через 2captcha"""
        if not self.captcha_solver:
            print("❌ 2captcha не настроен! Невозможно решить капчу автоматически.")
            return False
        
        try:
            print("🔄 Отправляем VK капчу в 2captcha для решения...")
            
            current_url = self.driver.current_url
            print(f"📍 URL: {current_url}")
            
            sid = captcha_data.get('sid')
            s = captcha_data.get('s')
            
            if not sid:
                print("❌ SID не найден в параметрах капчи!")
                return False
            
            print(f"⏳ Ожидаем решения от 2captcha (обычно 10-30 секунд)...")
            
            if s:
                result = self.captcha_solver.vk(sid=sid, s=s)
            else:
                result = self.captcha_solver.vk(sid=sid)
            
            captcha_key = result.get('code')
            print(f"✅ Капча решена! Ключ: {captcha_key}")
            
            try:
                captcha_input = self.driver.find_element(By.CSS_SELECTOR, 'input[name="captcha_key"], input[id="captcha_input"]')
                captcha_input.clear()
                captcha_input.send_keys(captcha_key)
                print("✅ Ключ капчи введен в поле")
                
                submit_button = self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"], input[type="submit"]')
                submit_button.click()
                print("✅ Форма капчи отправлена")
                
                time.sleep(3)
                return True
                
            except NoSuchElementException:
                print("⚠️ Поле капчи не найдено, пробуем прямой переход...")
                if '?' in current_url:
                    redirect_url = f"{current_url}&captcha_key={captcha_key}"
                else:
                    redirect_url = f"{current_url}?captcha_key={captcha_key}"
                
                self.driver.get(redirect_url)
                time.sleep(2)
                return True
            
        except Exception as e:
            print(f"❌ Ошибка решения VK капчи через 2captcha: {e}")
            import traceback
            print(f"🔍 Трассировка: {traceback.format_exc()}")
            return False
    
    def wait_for_content_load(self, timeout=45):
        """Ждет загрузки контента"""
        try:
            print("Ждем загрузки контента...")
            
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
            
            time.sleep(8)
            
            # Проверяем наличие капчи
            captcha_data = self.detect_vk_captcha()
            if captcha_data:
                print("🔒 VK капча обнаружена! Пытаемся решить...")
                if self.captcha_solver:
                    if self.solve_vk_captcha(captcha_data):
                        print("✅ Капча решена успешно!")
                        time.sleep(3)
                        self.driver.get(artist_url)
                        time.sleep(5)
                    else:
                        print("❌ Не удалось решить капчу автоматически!")
                        return []
                else:
                    print("⚠️  2captcha не настроен. Невозможно продолжить парсинг с капчей.")
                    return []
            
            if not self.wait_for_content_load():
                print("Контент не загрузился, пробуем парсить то, что есть")
            
            artist_name = self.extract_artist_name()
            self.scroll_to_playlists()
            playlists = self.find_playlists_on_page(artist_url, artist_name)
            
            return playlists
            
        except Exception as e:
            print(f"Ошибка парсинга страницы артиста: {e}")
            return []
    
    def extract_artist_name(self) -> str:
        """Извлекает имя артиста со страницы"""
        try:
            selectors = [
                'h1.page_name',
                '.page_name',
                'h1',
                '[class*="PageBlock__title"]'
            ]
            
            for selector in selectors:
                try:
                    element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    name = element.text.strip()
                    if name:
                        print(f"Найдено имя артиста: {name}")
                        return name
                except:
                    continue
            
            print("Имя артиста не найдено, используем URL")
            return "Неизвестный артист"
            
        except Exception as e:
            print(f"Ошибка извлечения имени артиста: {e}")
            return "Неизвестный артист"
    
    def scroll_to_playlists(self):
        """Скроллит страницу до блока с плейлистами"""
        try:
            print("Скроллим к блоку с плейлистами...")
            
            playlists_block = self.driver.find_element(
                By.CSS_SELECTOR, 
                '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists'
            )
            
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth'});", playlists_block)
            time.sleep(2)
            
            print("Прокрутка выполнена")
            
        except Exception as e:
            print(f"Ошибка прокрутки: {e}")
    
    def find_playlists_on_page(self, artist_url: str, artist_name: str) -> List[Dict]:
        """Ищет плейлисты на странице с фильтрацией"""
        try:
            playlists = []
            
            catalog_block = self.driver.find_element(
                By.CSS_SELECTOR,
                '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists.CatalogBlock__layout--large_slider'
            )
            
            gallery_items = catalog_block.find_elements(By.CSS_SELECTOR, '.ui_gallery_item')
            
            print(f"Найдено элементов галереи: {len(gallery_items)}")
            
            for item in gallery_items:
                try:
                    link_element = item.find_element(By.CSS_SELECTOR, 'a[href*="/music/playlist/"]')
                    playlist_url = link_element.get_attribute('href')
                    
                    img_element = link_element.find_element(By.CSS_SELECTOR, 'img')
                    
                    playlist_name = img_element.get_attribute('alt').strip()
                    playlist_cover_url = img_element.get_attribute('src')
                    
                    if not playlist_name or len(playlist_name) < 3:
                        continue
                    
                    if re.match(r'^\d+[\s\d\.KM]*$', playlist_name):
                        continue
                    
                    playlist_id, owner_id = self.extract_playlist_ids(playlist_url)
                    
                    playlist_data = {
                        'artist_url': artist_url,
                        'artist_name': artist_name,
                        'playlist_name': playlist_name,
                        'playlist_url': playlist_url,
                        'playlist_cover_url': playlist_cover_url,
                        'playlist_id': playlist_id,
                        'owner_id': owner_id
                    }
                    
                    playlists.append(playlist_data)
                    print(f"Найден плейлист: {playlist_name}")
                    
                except Exception as e:
                    continue
            
            return playlists
            
        except Exception as e:
            print(f"Ошибка поиска плейлистов: {e}")
            return []
    
    def extract_playlist_ids(self, playlist_url: str) -> tuple:
        """Извлекает ID плейлиста и владельца из URL"""
        try:
            match = re.search(r'/music/playlist/(-?\d+)_(-?\d+)', playlist_url)
            if match:
                return match.group(1), match.group(2)
        except:
            pass
        return '', ''
    
    def save_playlists_to_db(self, playlists: List[Dict], artist_name: str):
        """Сохраняет плейлисты в базу данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            saved_count = 0
            updated_count = 0
            
            for playlist in playlists:
                try:
                    cursor.execute('''
                        INSERT INTO vk_playlists 
                        (artist_url, artist_name, playlist_name, playlist_url, playlist_cover_url, playlist_id, owner_id, parsed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(artist_name, playlist_name, playlist_url) DO UPDATE SET
                        playlist_cover_url = excluded.playlist_cover_url,
                        playlist_id = excluded.playlist_id,
                        owner_id = excluded.owner_id,
                        parsed_at = excluded.parsed_at
                    ''', (
                        playlist['artist_url'],
                        playlist['artist_name'],
                        playlist['playlist_name'],
                        playlist['playlist_url'],
                        playlist['playlist_cover_url'],
                        playlist['playlist_id'],
                        playlist['owner_id'],
                        datetime.now()
                    ))
                    
                    if cursor.rowcount == 1:
                        saved_count += 1
                    else:
                        updated_count += 1
                        
                except Exception as e:
                    print(f"⚠️  Ошибка сохранения: {e}")
            
            conn.commit()
            conn.close()
            
            print(f"💾 Добавлено {saved_count} новых, обновлено {updated_count} плейлистов")
            print(f"📁 База данных: {os.path.abspath(self.db_path)}")
            
            # Проверяем, что данные действительно сохранились
            try:
                check_conn = sqlite3.connect(self.db_path)
                check_cursor = check_conn.cursor()
                check_cursor.execute('SELECT COUNT(*) FROM vk_playlists')
                total_count = check_cursor.fetchone()[0]
                check_conn.close()
                print(f"✅ Проверка: в БД всего {total_count} плейлистов")
            except Exception as check_error:
                print(f"⚠️  Ошибка проверки БД: {check_error}")
            
        except Exception as e:
            print(f"❌ Ошибка сохранения в БД: {e}")
            import traceback
            traceback.print_exc()
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("🚀 Запуск VK парсера для Linux")
        
        if not self.setup_driver():
            return False
        
        try:
            # Добавляем куки
            self.add_cookies()
            
            # Проверяем что куки добавились
            selenium_cookies = self.driver.get_cookies()
            print(f"✅ Кук в браузере: {len(selenium_cookies)}")
            
            for i, artist in enumerate(self.config.get('target_artists', []), 1):
                if isinstance(artist, str):
                    artist_url = artist
                else:
                    artist_url = artist.get('url', '')
                
                if not artist_url:
                    print(f"Пропущен артист {i}: нет URL")
                    continue
                
                print(f"\n{'='*60}")
                print(f"📍 Артист {i}/{len(self.config['target_artists'])}: {artist_url}")
                print(f"{'='*60}")
                
                playlists = self.parse_artist_page(artist_url)
                
                if playlists:
                    artist_name = playlists[0]['artist_name'] if playlists else "Неизвестный артист"
                    print(f"🎉 Найдено {len(playlists)} плейлистов для {artist_name}")
                    self.save_playlists_to_db(playlists, artist_name)
                else:
                    print(f"⚠️  Плейлисты не найдены")
                
                if i < len(self.config['target_artists']):
                    delay = random.uniform(5, 10)
                    print(f"⏳ Ждем {delay:.1f} секунд перед следующим артистом...")
                    time.sleep(delay)
            
            return True
        
        finally:
            if self.driver:
                self.driver.quit()
                print("🔒 WebDriver закрыт")
    
    def __del__(self):
        """Деструктор для закрытия WebDriver"""
        if hasattr(self, 'driver') and self.driver:
            self.driver.quit()

def main():
    """Главная функция"""
    print("=" * 60)
    print("🎵 VK Parser Production для Linux")
    print("=" * 60)
    
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    print(f"📁 Конфиг: {config_file}")
    
    parser = VKParser(config_file)
    
    if not parser.config.get('target_artists'):
        print("❌ Список артистов не настроен!")
        return False
    
    print(f"📋 Артистов для парсинга: {len(parser.config['target_artists'])}")
    
    try:
        success = parser.run_parsing_cycle()
        
        if success:
            print("\n✅ Парсинг завершен успешно!")
        else:
            print("\n❌ Парсинг завершен с ошибками")
            
        return success
        
    except KeyboardInterrupt:
        print("\n⚠️  Парсинг прерван пользователем")
        return False
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
