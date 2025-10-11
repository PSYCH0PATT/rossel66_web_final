#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VK Parser для Linux - версия с headless режимом + 2captcha
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
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    import re
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
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
        self.db_path = 'artist_playlists.db'
        self.driver = None
        self.captcha_solver = None
        self.init_database()
        self.init_captcha_solver()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Ошибка загрузки конфигурации: {e}")
        
        return {"target_artists": [], "captcha_api_key": None}
    
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
            print("ℹ️  2captcha не настроен. Парсинг может не работать при появлении капчи.")
    
    def detect_vk_captcha(self) -> Optional[Dict]:
        """Определяет наличие VK капчи на странице и извлекает параметры"""
        try:
            # Проверяем URL на наличие капчи
            current_url = self.driver.current_url
            if 'captcha.php' in current_url or '/captcha' in current_url:
                print("🔍 Обнаружена VK капча в URL!")
                
                # Извлекаем параметры из URL
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
            
            # Получаем текущий URL
            current_url = self.driver.current_url
            print(f"📍 URL: {current_url}")
            
            # Для VK капчи нужны параметры sid и s
            sid = captcha_data.get('sid')
            s = captcha_data.get('s')
            
            if not sid:
                print("❌ SID не найден в параметрах капчи!")
                return False
            
            print(f"⏳ Ожидаем решения от 2captcha (обычно 10-30 секунд)...")
            
            # Отправляем капчу в 2captcha
            if s:
                result = self.captcha_solver.vk(sid=sid, s=s)
            else:
                result = self.captcha_solver.vk(sid=sid)
            
            captcha_key = result.get('code')
            print(f"✅ Капча решена! Ключ: {captcha_key}")
            
            # Вставляем решение на страницу
            try:
                # Ищем поле для ввода капчи
                captcha_input = self.driver.find_element(By.CSS_SELECTOR, 'input[name="captcha_key"], input[id="captcha_input"]')
                captcha_input.clear()
                captcha_input.send_keys(captcha_key)
                print("✅ Ключ капчи введен в поле")
                
                # Ищем и нажимаем кнопку отправки
                submit_button = self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"], input[type="submit"]')
                submit_button.click()
                print("✅ Форма капчи отправлена")
                
                time.sleep(3)  # Даем время на обработку
                return True
                
            except NoSuchElementException:
                # Если поле не найдено, пробуем построить URL с ключом
                print("⚠️ Поле капчи не найдено, пробуем прямой переход...")
                # VK обычно принимает капчу через GET параметр
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
    
    def setup_driver(self):
        """Настраивает WebDriver для Linux (headless режим)"""
        chrome_options = Options()
        
        # Путь к Chromium в Docker контейнере (Alpine Linux)
        chrome_binary = os.environ.get('CHROME_BIN', '/usr/bin/chromium-browser')
        if os.path.exists(chrome_binary):
            chrome_options.binary_location = chrome_binary
        
        # HEADLESS режим для Linux
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-software-rasterizer')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        # Дополнительные опции для стабильности на сервере
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            print("Chrome WebDriver запущен (headless режим)")
            return True
        except Exception as e:
            print(f"Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def wait_for_content_load(self, timeout=45):
        """Ждет загрузки контента (увеличен таймаут для headless режима)"""
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
            
            # Ждем загрузки страницы (увеличено для headless режима)
            time.sleep(8)
            
            # Проверяем наличие капчи
            captcha_data = self.detect_vk_captcha()
            if captcha_data:
                print("🔒 VK капча обнаружена! Пытаемся решить...")
                if self.captcha_solver:
                    if self.solve_vk_captcha(captcha_data):
                        print("✅ Капча решена успешно!")
                        time.sleep(3)  # Даем время на обработку
                        # Перезагружаем страницу
                        self.driver.get(artist_url)
                        time.sleep(5)
                    else:
                        print("❌ Не удалось решить капчу автоматически!")
                        print("⚠️  Парсинг может не работать. Проверьте API ключ 2captcha.")
                        return []
                else:
                    print("⚠️  2captcha не настроен. Невозможно продолжить парсинг с капчей.")
                    return []
            
            # Ждем загрузки контента
            if not self.wait_for_content_load():
                print("Контент не загрузился, пробуем парсить то, что есть")
            
            # Извлекаем имя артиста
            artist_name = self.extract_artist_name()
            
            # Скроллим вниз для загрузки контента
            self.scroll_to_playlists()
            
            # Ищем плейлисты
            playlists = self.find_playlists_on_page(artist_url, artist_name)
            
            return playlists
            
        except Exception as e:
            print(f"Ошибка парсинга страницы артиста: {e}")
            return []
    
    def extract_artist_name(self) -> str:
        """Извлекает имя артиста со страницы"""
        try:
            # Пробуем несколько вариантов селекторов
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
            
            # Ищем блок с плейлистами
            playlists_block = self.driver.find_element(
                By.CSS_SELECTOR, 
                '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists'
            )
            
            # Скроллим к блоку
            self.driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth'});", playlists_block)
            time.sleep(2)
            
            print("Прокрутка выполнена")
            
        except Exception as e:
            print(f"Ошибка прокрутки: {e}")
    
    def find_playlists_on_page(self, artist_url: str, artist_name: str) -> List[Dict]:
        """Ищет плейлисты на странице с фильтрацией"""
        try:
            playlists = []
            
            # Ищем конкретный блок с плейлистами артиста
            catalog_block = self.driver.find_element(
                By.CSS_SELECTOR,
                '.CatalogBlock__content.CatalogBlock__artist_editorial_playlists.CatalogBlock__layout--large_slider'
            )
            
            # Внутри блока ищем элементы ui_gallery_item
            gallery_items = catalog_block.find_elements(By.CSS_SELECTOR, '.ui_gallery_item')
            
            print(f"Найдено элементов галереи: {len(gallery_items)}")
            
            for item in gallery_items:
                try:
                    # Ищем ссылку на плейлист
                    link_element = item.find_element(By.CSS_SELECTOR, 'a[href*="/music/playlist/"]')
                    playlist_url = link_element.get_attribute('href')
                    
                    # Внутри ссылки ищем img
                    img_element = link_element.find_element(By.CSS_SELECTOR, 'img')
                    
                    # Получаем название из alt
                    playlist_name = img_element.get_attribute('alt').strip()
                    
                    # Получаем обложку из src
                    playlist_cover_url = img_element.get_attribute('src')
                    
                    # Фильтруем - пропускаем статистические данные
                    if not playlist_name or len(playlist_name) < 3:
                        continue
                    
                    # Пропускаем если это числовые данные
                    if re.match(r'^\d+[\s\d\.KM]*$', playlist_name):
                        continue
                    
                    # Извлекаем ID плейлиста и владельца из URL
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
            # Формат: /music/playlist/PLAYLIST_ID_OWNER_ID
            match = re.search(r'/music/playlist/(-?\d+)_(-?\d+)', playlist_url)
            if match:
                return match.group(1), match.group(2)
        except:
            pass
        return '', ''
    
    def save_playlists_to_db(self, playlists: List[Dict], artist_name: str):
        """Сохраняет плейлисты в базу данных без дубликатов"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for playlist in playlists:
                # Проверяем, существует ли уже плейлист с таким названием и артистом
                cursor.execute('''
                    SELECT id FROM artist_playlists 
                    WHERE playlist_name = ? AND artist_name = ?
                ''', (playlist['playlist_name'], playlist['artist_name']))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Обновляем существующий плейлист
                    cursor.execute('''
                        UPDATE artist_playlists 
                        SET artist_url = ?, playlist_url = ?, playlist_cover_url = ?, 
                            playlist_id = ?, owner_id = ?, parsed_at = ?
                        WHERE playlist_name = ? AND artist_name = ?
                    ''', (
                        playlist['artist_url'],
                        playlist['playlist_url'],
                        playlist['playlist_cover_url'],
                        playlist['playlist_id'],
                        playlist['owner_id'],
                        datetime.now(),
                        playlist['playlist_name'],
                        playlist['artist_name']
                    ))
                else:
                    # Создаем новый плейлист
                    cursor.execute('''
                        INSERT INTO artist_playlists 
                        (artist_url, artist_name, playlist_name, playlist_url, playlist_cover_url, playlist_id, owner_id, parsed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
            
            conn.commit()
            conn.close()
            
            print(f"Сохранено {len(playlists)} плейлистов в базу данных")
            
        except Exception as e:
            print(f"Ошибка сохранения в БД: {e}")
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("Запуск VK парсера для Linux (headless режим)")
        
        if not self.setup_driver():
            return False
        
        try:
            for i, artist in enumerate(self.config.get('target_artists', []), 1):
                # Поддержка как строк (URL), так и объектов {url: ...}
                if isinstance(artist, str):
                    artist_url = artist
                else:
                    artist_url = artist.get('url', '')
                
                if not artist_url:
                    print(f"Пропущен артист {i}: нет URL")
                    continue
                
                print(f"\nАртист {i}/{len(self.config['target_artists'])}: {artist_url}")
                
                # Парсим страницу артиста
                playlists = self.parse_artist_page(artist_url)
                
                if playlists:
                    artist_name = playlists[0]['artist_name'] if playlists else "Неизвестный артист"
                    print(f"Найдено {len(playlists)} плейлистов для {artist_name}")
                    self.save_playlists_to_db(playlists, artist_name)
                    
                    # Выводим найденные плейлисты
                    for j, playlist in enumerate(playlists, 1):
                        print(f"  {j}. {playlist['playlist_name']}")
                else:
                    print(f"Плейлисты не найдены")
                
                # Задержка между запросами
                if i < len(self.config['target_artists']):
                    delay = random.uniform(5, 10)
                    print(f"Ждем {delay:.1f} секунд перед следующим артистом...")
                    time.sleep(delay)
            
            return True
        
        finally:
            if self.driver:
                self.driver.quit()
                print("WebDriver закрыт")
    
    def __del__(self):
        """Деструктор для закрытия WebDriver"""
        if hasattr(self, 'driver') and self.driver:
            self.driver.quit()

def main():
    """Главная функция"""
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("VK Parser для Linux (Headless)")
    print("=" * 50)
    
    parser = VKParser(config_file)
    
    # Проверяем конфигурацию
    if not parser.config.get('target_artists'):
        print("Список артистов не настроен!")
        return False
    
    print("Конфигурация загружена")
    print(f"Артистов для парсинга: {len(parser.config['target_artists'])}")
    
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

