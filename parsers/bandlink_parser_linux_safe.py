#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
БЕЗОПАСНАЯ версия Bandlink Parser для Linux с защитой от множественных запросов
Включает подробное логирование всех действий
"""

import json
import time
import random
import os
import sqlite3
import sys
import logging
from datetime import datetime
from typing import Dict, List, Optional

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('bandlink_parser.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    logger.error("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

try:
    from twocaptcha import TwoCaptcha
    TWOCAPTCHA_AVAILABLE = True
except ImportError:
    logger.warning("2captcha-python не установлен")
    TWOCAPTCHA_AVAILABLE = False

# Импортируем прямой HTTP клиент для 2captcha
try:
    from captcha_solver_direct import DirectCaptchaSolver
    DIRECT_SOLVER_AVAILABLE = True
except ImportError:
    logger.warning("Прямой HTTP клиент не найден")
    DIRECT_SOLVER_AVAILABLE = False

class SafeBandlinkParserLinux:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists.db'
        self.driver = None
        self.captcha_solver = None
        self.direct_solver = None  # Прямой HTTP клиент
        
        # ЗАЩИТА: Счетчики для предотвращения множественных запросов
        self.captcha_attempts = 0
        self.max_captcha_attempts = 3  # Максимум 3 попытки решения капчи
        self.captcha_requests_count = 0  # Счетчик запросов к 2captcha
        self.max_captcha_requests = 10  # Максимум 10 запросов за сессию
        self.captcha_cost_estimate = 0.0  # Оценка стоимости
        
        logger.info("="*60)
        logger.info("🛡️ БЕЗОПАСНАЯ версия Bandlink Parser для Linux")
        logger.info(f"🛡️ Защита: макс {self.max_captcha_attempts} попыток капчи")
        logger.info(f"🛡️ Защита: макс {self.max_captcha_requests} запросов к 2captcha")
        logger.info("="*60)
        
        self.init_database()
        self.init_captcha_solver()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        logger.info(f"🔍 Загрузка конфига: {self.config_file}")
        
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    logger.info(f"✅ Конфиг загружен")
                    logger.info(f"📋 Ключи конфига: {list(config.keys())}")
                    logger.info(f"🎵 Артистов для парсинга: {len(config.get('target_artists', []))}")
                    return config
            except Exception as e:
                logger.error(f"❌ Ошибка загрузки конфигурации: {e}")
        else:
            logger.error(f"❌ Конфиг файл не найден: {self.config_file}")
        
        return {"target_artists": [], "captcha_api_key": None}
    
    def init_database(self):
        """Инициализирует базу данных"""
        try:
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
            logger.info(f"✅ База данных инициализирована: {self.db_path}")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации базы данных: {e}")
    
    def init_captcha_solver(self):
        """Инициализирует 2captcha solver"""
        api_key = self.config.get('captcha_api_key')
        
        logger.info("🔍 Инициализация 2captcha solver...")
        logger.info(f"  - TWOCAPTCHA_AVAILABLE: {TWOCAPTCHA_AVAILABLE}")
        logger.info(f"  - DIRECT_SOLVER_AVAILABLE: {DIRECT_SOLVER_AVAILABLE}")
        logger.info(f"  - API ключ предоставлен: {bool(api_key)}")
        
        if not api_key:
            logger.error("❌ API ключ не предоставлен!")
            logger.error("⚠️ Парсер не сможет решать капчи автоматически")
            return
        
        # Приоритет: Прямой HTTP клиент (всегда работает)
        if DIRECT_SOLVER_AVAILABLE:
            try:
                self.direct_solver = DirectCaptchaSolver(api_key)
                logger.info(f"✅ Прямой HTTP клиент инициализирован (ключ: {api_key[:8]}...)")
                logger.info("✅ Метод yandexSmart доступен через прямой API")
                return
            except Exception as e:
                logger.error(f"❌ Ошибка инициализации прямого клиента: {e}")
        
        # Резервный вариант: библиотека 2captcha-python
        if api_key and TWOCAPTCHA_AVAILABLE:
            try:
                self.captcha_solver = TwoCaptcha(api_key)
                logger.info(f"✅ 2captcha библиотека инициализирована (ключ: {api_key[:8]}...)")
                
                # Проверяем наличие методов для Yandex SmartCaptcha
                if hasattr(self.captcha_solver, 'yandex'):
                    logger.info("✅ Метод 'yandex' доступен (официальный для Yandex SmartCaptcha)")
                elif hasattr(self.captcha_solver, 'yandexSmart'):
                    logger.info("✅ Метод 'yandexSmart' доступен")
                else:
                    logger.warning("⚠️ Ни метод 'yandex', ни 'yandexSmart' НЕ доступны в библиотеке!")
                    logger.warning("💡 Будет использован прямой HTTP клиент")
                    
            except Exception as e:
                logger.error(f"❌ Ошибка инициализации 2captcha: {e}")
                self.captcha_solver = None
        
        if not self.direct_solver and not self.captcha_solver:
            logger.error("❌ Ни один метод решения капч не доступен!")
            logger.error("⚠️ Парсер не сможет решать капчи автоматически")
    
    def detect_captcha(self) -> bool:
        """Определяет наличие Yandex SmartCaptcha"""
        try:
            logger.info("🔍 Проверка наличия капчи...")
            
            current_url = self.driver.current_url
            page_title = self.driver.title.lower()
            
            # Проверка 1: URL содержит "showcaptcha" или "captcha"
            if 'showcaptcha' in current_url.lower() or 'captcha' in current_url.lower():
                logger.warning("🔒 Обнаружена капча в URL!")
                logger.info(f"📍 URL: {current_url[:100]}...")
                return True
            
            # Проверка 2: Заголовок содержит "robot" или "captcha"
            if 'robot' in page_title or 'captcha' in page_title:
                logger.warning("🔒 Обнаружена капча в заголовке!")
                logger.info(f"📄 Заголовок: {page_title}")
                return True
            
            # Проверка 3: Ищем iframe с капчей
            captcha_iframes = self.driver.find_elements(
                By.CSS_SELECTOR, 
                'iframe[src*="smartcaptcha"], iframe[src*="captcha-api.yandex"], iframe[src*="yandex"]'
            )
            
            if len(captcha_iframes) > 0:
                logger.warning("🔒 Обнаружена Yandex SmartCaptcha!")
                logger.info(f"📊 Найдено iframe: {len(captcha_iframes)}")
                return True
            
            # Проверка 4: Проверяем контейнер капчи
            captcha_divs = self.driver.find_elements(
                By.CSS_SELECTOR, 
                'div[class*="SmartCaptcha"], div[id*="captcha"], div[class*="captcha"]'
            )
            
            if len(captcha_divs) > 0:
                logger.warning("🔒 Обнаружен контейнер капчи!")
                return True
            
            logger.info("✅ Капча не обнаружена")
            return False
            
        except Exception as e:
            logger.error(f"⚠️ Ошибка детекта капчи: {e}")
            return False
    
    def solve_yandex_smartcaptcha(self) -> bool:
        """
        БЕЗОПАСНОЕ решение Yandex SmartCaptcha
        С защитой от множественных запросов и подробным логированием
        """
        logger.info("="*60)
        logger.info("🔐 НАЧАЛО РЕШЕНИЯ КАПЧИ")
        logger.info("="*60)
        
        # ЗАЩИТА 1: Проверка счетчика попыток
        if self.captcha_attempts >= self.max_captcha_attempts:
            logger.error(f"❌ ЗАЩИТА: Превышен лимит попыток решения капчи ({self.max_captcha_attempts})")
            logger.error("⚠️ ОСТАНОВКА ПАРСЕРА ДЛЯ БЕЗОПАСНОСТИ")
            logger.error(f"💰 Оценка потраченных средств: ${self.captcha_cost_estimate:.4f}")
            return False
        
        # ЗАЩИТА 2: Проверка общего количества запросов
        if self.captcha_requests_count >= self.max_captcha_requests:
            logger.error(f"❌ ЗАЩИТА: Превышен лимит запросов к 2captcha ({self.max_captcha_requests})")
            logger.error("⚠️ ОСТАНОВКА ПАРСЕРА ДЛЯ БЕЗОПАСНОСТИ")
            logger.error(f"💰 Оценка потраченных средств: ${self.captcha_cost_estimate:.4f}")
            return False
        
        if not self.direct_solver and not self.captcha_solver:
            logger.error("❌ 2captcha не настроен!")
            return False
        
        try:
            self.captcha_attempts += 1
            logger.info(f"🔄 Попытка решения капчи {self.captcha_attempts}/{self.max_captcha_attempts}")
            
            current_url = self.driver.current_url
            logger.info(f"📍 URL: {current_url}")
            
            # Получаем sitekey (как в GitHub проекте)
            logger.info("🔍 Получаем sitekey с страницы...")
            try:
                sitekey = self.driver.execute_script("""
                    var container = document.querySelector('[data-sitekey]');
                    if (container) {
                        return container.getAttribute('data-sitekey');
                    }
                    // Пробуем альтернативные селекторы
                    var smartcaptcha = document.querySelector('.smart-captcha');
                    if (smartcaptcha) {
                        return smartcaptcha.getAttribute('data-sitekey');
                    }
                    return null;
                """)
                
                if not sitekey:
                    logger.error("❌ Sitekey не найден на странице!")
                    logger.info("🔍 HTML страницы (первые 500 символов):")
                    logger.info(self.driver.page_source[:500])
                    return False
                
                logger.info(f"✅ Sitekey найден: {sitekey[:20]}...")
                
            except Exception as e:
                logger.error(f"❌ Ошибка получения sitekey: {e}")
                import traceback
                logger.error(f"🔍 Трассировка: {traceback.format_exc()}")
                return False
            
            # ЗАЩИТА 3: Увеличиваем счетчик ПЕРЕД отправкой
            self.captcha_requests_count += 1
            self.captcha_cost_estimate += 0.0015  # Примерная стоимость одного запроса
            
            logger.warning(f"📊 ЗАПРОС К 2CAPTCHA #{self.captcha_requests_count}/{self.max_captcha_requests}")
            logger.warning(f"💰 Оценка стоимости: ${self.captcha_cost_estimate:.4f}")
            
            # Отправляем в 2captcha
            logger.info(f"📤 Отправляем капчу в 2captcha...")
            logger.info(f"   Параметры:")
            logger.info(f"   - pageurl: {current_url}")
            logger.info(f"   - sitekey: {sitekey[:20]}...")
            logger.info(f"⏳ Ожидаем решения (обычно 20-60 секунд)...")
            
            start_time = time.time()
            
            try:
                # Приоритет: Прямой HTTP клиент
                if self.direct_solver:
                    logger.info("🌐 Используем прямой HTTP API 2captcha")
                    result = self.direct_solver.solve_yandex_smart(
                        sitekey=sitekey,
                        pageurl=current_url
                    )
                    
                    elapsed_time = time.time() - start_time
                    logger.info(f"⏱️ Общее время: {elapsed_time:.2f} секунд")
                    
                    if not result['success']:
                        logger.error(f"❌ Не удалось решить капчу!")
                        logger.error(f"🔍 Ошибка: {result['error']}")
                        return False
                    
                    token = result['token']
                    logger.info(f"✅ Капча решена через прямой API!")
                    logger.info(f"🔑 Токен (первые 50 символов): {token[:50]}...")
                    
                # Резервный вариант: библиотека 2captcha-python
                elif self.captcha_solver:
                    logger.info("📚 Используем библиотеку 2captcha-python")
                    
                    # Проверяем доступные методы
                    if hasattr(self.captcha_solver, 'yandex'):
                        logger.info("✅ Используем метод 'yandex' (официальный для Yandex SmartCaptcha)")
                        result = self.captcha_solver.yandex(
                            sitekey=sitekey,
                            url=current_url
                        )
                    elif hasattr(self.captcha_solver, 'yandexSmart'):
                        logger.info("✅ Используем метод 'yandexSmart'")
                        result = self.captcha_solver.yandexSmart(
                            pageurl=current_url,
                            sitekey=sitekey
                        )
                    else:
                        logger.error("❌ Ни метод 'yandex', ни 'yandexSmart' не доступны!")
                        return False
                    
                    elapsed_time = time.time() - start_time
                    logger.info(f"⏱️ Время решения: {elapsed_time:.2f} секунд")
                    
                    token = result.get('code')
                    
                    if not token:
                        logger.error(f"❌ Не получен токен от 2captcha!")
                        logger.error(f"🔍 Полный ответ: {result}")
                        return False
                    
                    logger.info(f"✅ Капча решена через библиотеку!")
                    logger.info(f"🔑 Токен (первые 50 символов): {token[:50]}...")
                else:
                    logger.error("❌ Ни один метод решения капчи не доступен!")
                    return False
                
                # Вставляем токен в поле (как в GitHub проекте)
                logger.info("🔧 Вставляем токен в поле на странице...")
                
                insert_result = self.driver.execute_script(f"""
                    var tokenInput = document.querySelector('input[data-testid="smart-token"]') 
                                  || document.querySelector('input[name="smart-token"]')
                                  || document.querySelector('input[name="smart_token"]')
                                  || document.querySelector('input[type="hidden"]');
                    if (tokenInput) {{
                        tokenInput.value = '{token}';
                        console.log('Token inserted successfully');
                        return true;
                    }} else {{
                        console.log('Token input not found');
                        return false;
                    }}
                """)
                
                if insert_result:
                    logger.info("✅ Токен успешно вставлен в поле")
                else:
                    logger.warning("⚠️ Поле для токена не найдено!")
                    logger.info("🔍 Возможно, капча уже решена или структура страницы изменилась")
                
                time.sleep(2)
                
                logger.info("="*60)
                logger.info("✅ Yandex SmartCaptcha решена успешно!")
                logger.info("="*60)
                
                return True
                
            except AttributeError as e:
                logger.error("❌ Метод yandexSmart не доступен!")
                logger.error(f"   Ошибка: {e}")
                logger.error("💡 Используйте библиотеку 2captcha-ts или Anti-Captcha")
                return False
                
            except Exception as e:
                elapsed_time = time.time() - start_time
                logger.error(f"❌ Ошибка решения капчи: {e}")
                logger.error(f"⏱️ Время до ошибки: {elapsed_time:.2f} секунд")
                import traceback
                logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка решения капчи: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return False
    
    def setup_driver(self):
        """Настраивает WebDriver для Linux"""
        try:
            logger.info("🔧 Настройка Chrome драйвера для Linux...")
            
            options = Options()
            
            # Настройки для Linux headless режима
            chrome_binary = os.environ.get('CHROME_BIN', '/usr/bin/chromium-browser')
            if os.path.exists(chrome_binary):
                options.binary_location = chrome_binary
                logger.info(f"📍 Chrome binary: {chrome_binary}")
            
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--headless')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--disable-gpu')
            options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            logger.info("🚀 Запуск Chrome браузера...")
            self.driver = webdriver.Chrome(options=options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info("✅ Chrome драйвер настроен успешно")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка настройки драйвера: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return False
    
    def navigate_to_scanner(self) -> bool:
        """Переходит на страницу сканера"""
        try:
            logger.info("="*60)
            logger.info("🌐 Переход на band.link/scanner")
            logger.info("="*60)
            
            self.driver.get('https://band.link/scanner')
            delay = random.uniform(3, 6)
            logger.info(f"⏳ Ожидание {delay:.1f} секунд...")
            time.sleep(delay)
            
            current_url = self.driver.current_url
            page_title = self.driver.title
            
            logger.info(f"📍 URL: {current_url}")
            logger.info(f"📄 Заголовок: {page_title}")
            
            # Проверяем капчу ОДИН РАЗ
            if self.detect_captcha():
                logger.warning("🔒 Капча обнаружена! Пытаемся решить...")
                if not self.solve_yandex_smartcaptcha():
                    logger.error("❌ Не удалось решить капчу!")
                    logger.error("⚠️ Парсинг может не работать")
                    return False
                else:
                    logger.info("✅ Капча успешно решена")
            else:
                logger.info("✅ Капча не обнаружена")
            
            logger.info("✅ Страница загружена успешно")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка перехода на страницу: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return False
    
    def search_artist(self, artist_name: str) -> bool:
        """Ищет артиста на странице band.link/scanner"""
        try:
            logger.info(f"🔍 Поиск артиста: {artist_name}")
            
            # Ищем поле поиска
            search_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="text"], input[placeholder*="artist"], input[name*="search"]')
            search_input.clear()
            
            # Вводим имя артиста
            for char in artist_name:
                search_input.send_keys(char)
                time.sleep(random.uniform(0.1, 0.3))
            
            logger.info("⏳ Ожидание результатов...")
            time.sleep(3)
            
            logger.info(f"✅ Артист '{artist_name}' введен в поиск")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка поиска артиста: {e}")
            return False
    
    def parse_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты для артиста"""
        try:
            logger.info(f"🎵 Парсинг плейлистов для: {artist_name}")
            
            # Ждем загрузки плейлистов
            time.sleep(5)
            
            # Ищем контейнеры с плейлистами
            playlist_containers = self.driver.find_elements(
                By.CSS_SELECTOR,
                'article, div[class*="playlist"], div[class*="card"]'
            )
            
            logger.info(f"📊 Найдено контейнеров: {len(playlist_containers)}")
            
            playlists = []
            
            for container in playlist_containers[:10]:  # Берем первые 10
                try:
                    playlist_data = {
                        'playlist_name': '',
                        'playlist_url': '',
                        'playlist_artist': artist_name,
                        'track_names': '',
                        'likes_count': '',
                        'platform': '',
                        'playlist_cover_url': ''
                    }
                    
                    # Парсим название
                    try:
                        name_elem = container.find_element(By.CSS_SELECTOR, 'h3, h4, [class*="title"]')
                        playlist_data['playlist_name'] = name_elem.text.strip()
                    except:
                        pass
                    
                    # Парсим URL
                    try:
                        link_elem = container.find_element(By.CSS_SELECTOR, 'a')
                        playlist_data['playlist_url'] = link_elem.get_attribute('href')
                    except:
                        pass
                    
                    if playlist_data['playlist_name']:
                        playlists.append(playlist_data)
                        logger.info(f"  ✅ Плейлист: {playlist_data['playlist_name']}")
                        
                except Exception as e:
                    logger.debug(f"  ⚠️ Ошибка парсинга контейнера: {e}")
                    continue
            
            logger.info(f"✅ Найдено плейлистов: {len(playlists)}")
            return playlists
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга плейлистов: {e}")
            return []
    
    def save_playlists_to_db(self, playlists: List[Dict], artist_name: str):
        """Сохраняет плейлисты в базу данных"""
        try:
            logger.info(f"💾 Сохранение {len(playlists)} плейлистов в БД...")
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            added_count = 0
            updated_count = 0
            
            for playlist in playlists:
                # Проверяем существование
                cursor.execute('''
                    SELECT id FROM bandlink_playlists 
                    WHERE playlist_name = ? AND artist_name = ?
                ''', (playlist['playlist_name'], artist_name))
                
                exists = cursor.fetchone()
                
                if exists:
                    # Обновляем
                    cursor.execute('''
                        UPDATE bandlink_playlists 
                        SET playlist_url = ?, parsed_at = ?
                        WHERE playlist_name = ? AND artist_name = ?
                    ''', (
                        playlist['playlist_url'],
                        datetime.now(),
                        playlist['playlist_name'],
                        artist_name
                    ))
                    updated_count += 1
                else:
                    # Добавляем
                    cursor.execute('''
                        INSERT INTO bandlink_playlists 
                        (artist_name, playlist_name, playlist_artist, track_names, 
                         likes_count, platform, playlist_cover_url, playlist_url, parsed_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        artist_name,
                        playlist['playlist_name'],
                        playlist['playlist_artist'],
                        playlist.get('track_names', ''),
                        playlist.get('likes_count', ''),
                        playlist.get('platform', ''),
                        playlist.get('playlist_cover_url', ''),
                        playlist['playlist_url'],
                        datetime.now()
                    ))
                    added_count += 1
            
            conn.commit()
            conn.close()
            
            logger.info(f"✅ Добавлено: {added_count}, Обновлено: {updated_count}")
            
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения в БД: {e}")
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        logger.info("="*60)
        logger.info("🚀 ЗАПУСК БЕЗОПАСНОГО ПАРСЕРА")
        logger.info("="*60)
        
        start_time = datetime.now()
        logger.info(f"⏰ Время начала: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if not self.setup_driver():
            logger.error("❌ Не удалось настроить драйвер")
            return False
        
        try:
            if not self.navigate_to_scanner():
                logger.error("❌ Ошибка перехода на страницу")
                return False
            
            artists = self.config.get('target_artists', [])
            if not artists:
                logger.error("❌ Список артистов не настроен!")
                return False
            
            logger.info(f"📋 Начинаем парсинг {len(artists)} артистов...")
            
            for i, artist in enumerate(artists, 1):
                logger.info("\n" + "="*50)
                logger.info(f"🎵 Артист {i}/{len(artists)}: {artist}")
                logger.info("="*50)
                
                # Парсим артиста
                if not self.search_artist(artist):
                    logger.error(f"❌ Не удалось найти артиста: {artist}")
                    continue
                
                # Парсим плейлисты
                playlists = self.parse_playlists(artist)
                
                if playlists:
                    logger.info(f"✅ Найдено {len(playlists)} плейлистов")
                    self.save_playlists_to_db(playlists, artist)
                else:
                    logger.warning(f"⚠️ Плейлисты не найдены для артиста: {artist}")
                
                if i < len(artists):
                    delay = random.uniform(10, 20)
                    logger.info(f"⏳ Пауза {delay:.1f} секунд перед следующим артистом...")
                    time.sleep(delay)
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            logger.info("\n" + "="*60)
            logger.info("✅ ПАРСИНГ ЗАВЕРШЕН!")
            logger.info("="*60)
            logger.info(f"⏰ Время окончания: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"⏱️ Продолжительность: {duration:.2f} секунд")
            logger.info(f"\n📊 СТАТИСТИКА:")
            logger.info(f"  - Попыток решения капчи: {self.captcha_attempts}/{self.max_captcha_attempts}")
            logger.info(f"  - Запросов к 2captcha: {self.captcha_requests_count}/{self.max_captcha_requests}")
            logger.info(f"  - Оценка потраченных средств: ${self.captcha_cost_estimate:.4f}")
            logger.info(f"  - Артистов обработано: {len(artists)}")
            logger.info("="*60)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка парсинга: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return False
            
        finally:
            if self.driver:
                self.driver.quit()
                logger.info("🔒 WebDriver закрыт")

def main():
    """Главная функция"""
    logger.info("="*60)
    logger.info("🛡️ БЕЗОПАСНАЯ ВЕРСИЯ BANDLINK PARSER ДЛЯ LINUX")
    logger.info("="*60)
    
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not config_file:
        logger.error("❌ Не указан конфиг файл!")
        logger.info("💡 Использование: python3 bandlink_parser_linux_safe.py <config_file>")
        return
    
    logger.info(f"📁 Конфиг файл: {config_file}")
    
    parser = SafeBandlinkParserLinux(config_file)
    success = parser.run_parsing_cycle()
    
    if success:
        logger.info("✅ Парсинг завершен успешно!")
    else:
        logger.error("❌ Парсинг завершен с ошибками")
    
    logger.info("="*60)

if __name__ == "__main__":
    main()

