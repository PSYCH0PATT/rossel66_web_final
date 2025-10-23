#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Linux с Residential Proxy + Selenium
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

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("❌ Selenium не установлен. Установите: pip install selenium webdriver-manager")
    sys.exit(1)

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
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]


class ResidentialSeleniumParser:
    """Класс для работы с Bright Data Residential Proxy через Selenium"""
    
    def __init__(self, username: str, password: str, host: str = "brd.superproxy.io", port: int = 33335):
        """
        Инициализация Residential Proxy парсера с Selenium
        
        Args:
            username: Proxy username
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
        
        self.driver = None
        
        logger.info("🔧 Инициализация Residential Selenium парсера...")
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
    
    def get_cookies_from_db(self) -> List[Dict]:
        """Загрузка cookies из SQLite базы данных"""
        cookies = []
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT cookie_name, cookie_value FROM bandlink_cookies")
            rows = cursor.fetchall()
            
            for row in rows:
                cookies.append({
                    'name': row[0],
                    'value': row[1]
                    # domain не указываем - Selenium сам определит из текущего URL
                })
            
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
    
    def init_driver(self, session_id: str = None):
        """Инициализация Selenium WebDriver с Residential Proxy"""
        try:
            chrome_options = Options()
            
            # Формируем proxy username с session ID
            proxy_username = self.proxy_username
            if session_id:
                proxy_username = f"{self.proxy_username}-session-{session_id}"
            
            # Настройка прокси (временно отключено для теста)
            # proxy_url = f"{self.proxy_host}:{self.proxy_port}"
            # chrome_options.add_argument(f'--proxy-server=http://{proxy_url}')
            
            # User-Agent
            user_agent = self.get_random_user_agent()
            chrome_options.add_argument(f'user-agent={user_agent}')
            
            # Mac: простые настройки как в старом парсере
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Уникальный user-data-dir в workspace для Mac
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            user_data_dir = os.path.join(os.path.dirname(__file__), '..', 'chrome_profiles', f'profile_{unique_id}')
            os.makedirs(user_data_dir, exist_ok=True)
            chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
            logger.info(f"📁 User data dir: {user_data_dir}")
            
            # Отключаем headless режим для Mac (может вызывать проблемы)
            # chrome_options.add_argument('--headless=new')
            
            # Размер окна
            chrome_options.add_argument('--window-size=1920,1080')
            
            logger.info(f"🚀 Запуск Chrome с Residential Proxy...")
            logger.info(f"   Session ID: {session_id or 'default'}")
            logger.info(f"   User-Agent: {user_agent[:60]}...")
            
            # Используем webdriver-manager для автоматического управления ChromeDriver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Убираем флаг webdriver (как в старом парсере)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Настройка таймаутов
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            # Авторизация прокси через Chrome DevTools Protocol (временно отключено)
            # self.driver.execute_cdp_cmd('Network.enable', {})
            # self.driver.execute_cdp_cmd('Network.setExtraHTTPHeaders', {
            #     'headers': {
            #         'Proxy-Authorization': f'Basic {self._encode_proxy_auth(proxy_username, self.proxy_password)}'
            #     }
            # })
            
            logger.info("✅ Chrome WebDriver инициализирован")
            
            # Проверяем, что драйвер работает
            try:
                current_url = self.driver.current_url
                logger.info(f"📍 Текущий URL: {current_url}")
            except Exception as e:
                logger.error(f"❌ Ошибка получения URL: {e}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации WebDriver: {e}")
            return False
    
    def _encode_proxy_auth(self, username: str, password: str) -> str:
        """Кодирование авторизации для прокси в base64"""
        import base64
        auth_string = f"{username}:{password}"
        return base64.b64encode(auth_string.encode()).decode()
    
    def load_page_with_cookies(self, url: str) -> bool:
        """Загрузка страницы с cookies"""
        try:
            # Загружаем cookies из БД
            cookies = self.get_cookies_from_db()
            
            # Сначала загружаем страницу
            logger.info(f"🔗 Загрузка: {url}")
            self.driver.get(url)
            
            # Имитация человека
            self.human_delay(2, 4)
            
            # Добавляем cookies
            if cookies:
                for cookie in cookies:
                    try:
                        self.driver.add_cookie(cookie)
                    except Exception as e:
                        logger.warning(f"⚠️  Не удалось добавить cookie {cookie['name']}: {e}")
                
                # Перезагружаем страницу с cookies
                logger.info("🔄 Перезагрузка страницы с cookies...")
                self.driver.get(url)
                self.human_delay(3, 5)
            
            logger.info("✅ Страница загружена")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки страницы: {e}")
            return False
    
    def check_for_captcha(self) -> bool:
        """Проверка наличия капчи на странице"""
        try:
            # Ищем элементы капчи
            captcha_selectors = [
                '[class*="captcha"]',
                '[class*="smartcaptcha"]',
                'iframe[src*="captcha"]',
                '#captcha-container'
            ]
            
            for selector in captcha_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    logger.warning(f"⚠️  Обнаружена капча: {selector}")
                    return True
            
            return False
            
        except Exception:
            return False
    
    def click_show_all_button(self):
        """Нажимает кнопку 'Показать все'"""
        try:
            logger.info("🔍 Ищем кнопку 'Показать все'...")
            
            # Пробуем разные селекторы
            button_selectors = [
                "button:contains('Показать все')",
                "button:contains('Show all')",
                "[class*='showAll']",
                "[class*='show-all']"
            ]
            
            for selector in button_selectors:
                try:
                    button = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    button.click()
                    logger.info("✅ Кнопка 'Показать все' нажата")
                    self.human_delay(2, 4)
                    return True
                except:
                    continue
            
            logger.info("ℹ️  Кнопка 'Показать все' не найдена (возможно не нужна)")
            return False
            
        except Exception as e:
            logger.warning(f"⚠️  Ошибка с кнопкой 'Показать все': {e}")
            return False
    
    def scroll_to_load_all(self):
        """Прокручивает страницу для загрузки всех плейлистов"""
        try:
            logger.info("📜 Прокручиваем страницу для загрузки всего контента...")
            
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            scroll_attempts = 0
            max_attempts = 10
            
            while scroll_attempts < max_attempts:
                # Прокручиваем вниз
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(random.uniform(1, 2))
                
                # Получаем новую высоту
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                
                if new_height == last_height:
                    break
                
                last_height = new_height
                scroll_attempts += 1
            
            logger.info(f"✅ Прокрутка завершена ({scroll_attempts} попыток)")
            
        except Exception as e:
            logger.warning(f"⚠️  Ошибка прокрутки: {e}")
    
    def extract_playlist_data_from_container(self, container, artist_name: str) -> Optional[Dict]:
        """Извлекает данные плейлиста из контейнера"""
        try:
            playlist_data = {
                'artist_name': artist_name,
                'playlist_name': '',
                'playlist_artist': '',
                'track_names': '',
                'platform': '',
                'playlist_cover_url': '',
                'playlist_url': '',
                'parsed_at': datetime.now().isoformat()
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
                
                # Определяем платформу по URL
                if 'spotify.com' in playlist_url:
                    playlist_data['platform'] = 'Spotify'
                elif 'music.apple.com' in playlist_url:
                    playlist_data['platform'] = 'Apple Music'
                elif 'music.youtube.com' in playlist_url or 'youtube.com/playlist' in playlist_url:
                    playlist_data['platform'] = 'YouTube Music'
                elif 'music.yandex.ru' in playlist_url:
                    playlist_data['platform'] = 'Яндекс Музыка'
                elif 'vk.com' in playlist_url:
                    playlist_data['platform'] = 'VK Музыка'
                elif 'music.mts.ru' in playlist_url:
                    playlist_data['platform'] = 'МТС Музыка'
                else:
                    playlist_data['platform'] = 'Unknown'
            except:
                pass
            
            # Обложка плейлиста
            try:
                cover_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionCover"] img')
                playlist_data['playlist_cover_url'] = cover_element.get_attribute('src')
            except:
                pass
            
            # Проверяем что есть хотя бы название и ссылка
            if playlist_data['playlist_name'] and playlist_data['playlist_url']:
                return playlist_data
            
            return None
            
        except Exception as e:
            logger.debug(f"⚠️  Ошибка извлечения данных контейнера: {e}")
            return None
    
    def parse_artist_playlists(self, artist_name: str) -> List[Dict]:
        """
        Парсинг плейлистов артиста с band.link
        
        Args:
            artist_name: Имя артиста
        
        Returns:
            List[Dict]: Список найденных плейлистов
        """
        logger.info(f"🎵 Парсинг артиста: {artist_name}")
        
        playlists = []
        
        try:
            # Формируем URL (правильный формат как в других парсерах)
            search_query = artist_name.replace(' ', '+')
            url = f"https://band.link/scanner?q={search_query}"
            
            # Загружаем страницу
            if not self.load_page_with_cookies(url):
                return []
            
            # Проверяем капчу
            if self.check_for_captcha():
                self.captcha_attempts += 1
                logger.warning(f"⚠️  КАПЧА ОБНАРУЖЕНА! Попытка {self.captcha_attempts} из {self.max_captcha_attempts}")
                
                if self.captcha_attempts < self.max_captcha_attempts:
                    # Закрываем браузер
                    if self.driver:
                        self.driver.quit()
                    
                    # Новый session ID
                    self.current_session_id = self.get_new_session_id()
                    
                    # Задержка
                    wait_time = random.uniform(120, 180)
                    logger.info(f"⏱️  Ожидание {wait_time/60:.1f} минут перед повтором...")
                    time.sleep(wait_time)
                    
                    # Переинициализируем драйвер с новым IP
                    self.init_driver(self.current_session_id)
                    
                    # Повторяем попытку
                    return self.parse_artist_playlists(artist_name)
                else:
                    logger.error(f"❌ Достигнут лимит попыток ({self.max_captcha_attempts})")
                    self.update_parser_status("failed", needs_new_cookies=1, failed_attempts=self.captcha_attempts)
                    return []
            
            # Нажимаем "Показать все" если есть
            self.click_show_all_button()
            
            # Прокручиваем страницу
            self.scroll_to_load_all()
            
            # Ищем контейнер с плейлистами
            logger.info("🔍 Ищем контейнеры с плейлистами...")
            
            try:
                artist_type_container = self.driver.find_element(By.CSS_SELECTOR, 'div[class*="card_artistType"]')
                logger.info("✅ Найден контейнер card_artistType")
                
                # Ищем все контейнеры плейлистов
                horizontal_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_horizontalContainer"]')
                vertical_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_verticalContainer"]')
                
                all_containers = horizontal_containers + vertical_containers
                
                logger.info(f"📦 Найдено {len(horizontal_containers)} horizontal + {len(vertical_containers)} vertical = {len(all_containers)} контейнеров")
                
                # Извлекаем данные
                seen_urls = set()
                for container in all_containers:
                    playlist_data = self.extract_playlist_data_from_container(container, artist_name)
                    if playlist_data and playlist_data['playlist_url'] not in seen_urls:
                        playlists.append(playlist_data)
                        seen_urls.add(playlist_data['playlist_url'])
                        logger.info(f"   ✅ {playlist_data['platform']}: {playlist_data['playlist_name']}")
                
            except NoSuchElementException:
                logger.warning("⚠️  Контейнер card_artistType не найден")
            
            logger.info(f"🎉 Найдено {len(playlists)} уникальных плейлистов для {artist_name}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга артиста {artist_name}: {e}")
            import traceback
            logger.debug(traceback.format_exc())
        
        return playlists
    
    def save_playlists_to_db(self, playlists: List[Dict]):
        """Сохранение плейлистов в SQLite базу данных"""
        if not playlists:
            return
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
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
        
        # Инициализируем WebDriver
        if not self.init_driver(self.current_session_id):
            logger.error("❌ Не удалось инициализировать WebDriver")
            return
        
        try:
            total_playlists = 0
            
            for i, artist_name in enumerate(artists, 1):
                logger.info(f"\n{'='*60}")
                logger.info(f"📍 Артист {i}/{len(artists)}: {artist_name}")
                logger.info(f"{'='*60}")
                
                playlists = self.parse_artist_playlists(artist_name)
                
                if playlists:
                    self.save_playlists_to_db(playlists)
                    total_playlists += len(playlists)
                
                # Задержка между артистами
                if i < len(artists):
                    self.human_delay(5, 10)
            
            logger.info(f"\n{'='*60}")
            logger.info(f"🎉 Парсинг завершен!")
            logger.info(f"📊 Всего найдено плейлистов: {total_playlists}")
            logger.info(f"{'='*60}")
            
            # Обновляем статус в БД (успешно)
            self.update_parser_status("completed", needs_new_cookies=0, failed_attempts=0)
            
        finally:
            # Закрываем браузер
            if self.driver:
                self.driver.quit()
                logger.info("🔒 Браузер закрыт")


def main():
    """Основная функция"""
    if len(sys.argv) < 2:
        logger.error("❌ Не указан файл конфигурации")
        logger.info("💡 Использование: python3 bandlink_parser_residential_selenium.py <config.json>")
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
    parser = ResidentialSeleniumParser(
        username=proxy_username,
        password=proxy_password,
        host=proxy_host,
        port=proxy_port
    )
    
    # Запускаем парсинг
    parser.run_parsing_cycle(artists)


if __name__ == "__main__":
    main()

