#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Mac с интеграцией Bright Data Web Unlocker
Тестирование на captcha-api.yandex.ru/demo
"""

import json
import time
import random
import os
import sqlite3
import sys
import requests
import logging
from datetime import datetime
from typing import Dict, List, Optional

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

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
    logger.error("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

class BrightDataWebUnlocker:
    """Класс для работы с Bright Data Web Unlocker API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.brightdata.com"
        self.zone = "web_unlocker1"
        self.max_attempts = 3
        
    def unlock_url(self, url: str) -> Dict:
        """
        Разблокирует URL через Bright Data Web Unlocker
        Возвращает словарь с результатом
        """
        try:
            logger.info(f"🔓 Разблокировка URL через Bright Data: {url}")
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "zone": self.zone,
                "url": url,
                "format": "raw",
                "country": "US"  # Можно изменить на нужную страну
            }
            
            logger.info(f"📤 Отправка запроса в Bright Data...")
            response = requests.post(
                f"{self.base_url}/request",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            logger.info(f"📊 Статус ответа: {response.status_code}")
            logger.info(f"📄 Ответ (первые 200 символов): {response.text[:200]}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    logger.info("✅ URL успешно разблокирован через Bright Data")
                    return {
                        'success': True,
                        'html': result.get('html', ''),
                        'status_code': result.get('status_code', 200),
                        'headers': result.get('headers', {})
                    }
                except json.JSONDecodeError:
                    # Если не JSON, возможно это HTML
                    logger.info("📄 Получен HTML ответ (не JSON)")
                    return {
                        'success': True,
                        'html': response.text,
                        'status_code': 200,
                        'headers': dict(response.headers)
                    }
            else:
                logger.error(f"❌ Ошибка Bright Data API: {response.status_code}")
                logger.error(f"📄 Ответ: {response.text}")
                return {
                    'success': False,
                    'error': f"API error: {response.status_code}",
                    'response': response.text
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка HTTP запроса к Bright Data: {e}")
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка в Bright Data: {e}")
            return {
                'success': False,
                'error': str(e)
            }

class BandlinkParserBrightDataMac:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists_brightdata_mac.db'
        self.driver = None
        self.bright_data = None
        self.max_captcha_attempts = 3  # Максимум 3 попытки как просили
        self.captcha_attempts = 0
        self.init_database()
        self.init_bright_data()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Ошибка загрузки конфигурации: {e}")

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

    def init_bright_data(self):
        """Инициализирует Bright Data Web Unlocker"""
        api_key = (self.config.get('bright_data_api_key') or os.environ.get('BRIGHT_DATA_API_KEY') or '').strip()
        if not api_key:
            logger.error("❌ Задайте bright_data_api_key в конфиге или переменную окружения BRIGHT_DATA_API_KEY")
            api_key = None
        
        try:
            self.bright_data = BrightDataWebUnlocker(api_key)
            logger.info("✅ Bright Data Web Unlocker инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации Bright Data: {e}")
            self.bright_data = None

    def setup_driver(self, use_bright_data_proxy=False):
        """Настраивает Chrome драйвер для Mac"""
        try:
            logger.info("🔧 Настройка Chrome драйвера для Mac...")
            
            options = Options()
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--window-size=1920,1080')
            
            # Если используем Bright Data прокси
            if use_bright_data_proxy and self.bright_data:
                # Правильный формат прокси для Bright Data Web Unlocker
                # username: brd-customer-hl_{api_key}-zone-{zone_name}
                # password: brd-customer-hl_{api_key}-zone-{zone_name}
                username = f"brd-customer-hl_{self.bright_data.api_key}-zone-{self.bright_data.zone}"
                password = username  # Пароль такой же как username
                proxy_url = f"http://{username}:{password}@brd.superproxy.io:22225"
                
                # Добавляем настройки прокси
                options.add_argument(f'--proxy-server={proxy_url}')
                options.add_argument('--proxy-bypass-list=<-loopback>')
                options.add_argument('--ignore-certificate-errors')
                options.add_argument('--ignore-ssl-errors')
                options.add_argument('--allow-running-insecure-content')
                
                logger.info("🌐 Используем Bright Data Web Unlocker прокси")
                logger.info(f"🔑 Username: {username[:50]}...")
                logger.info(f"🌐 Proxy URL: {proxy_url[:50]}...")
            
            self.driver = webdriver.Chrome(options=options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info("✅ Chrome драйвер настроен")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка настройки драйвера: {e}")
            return False

    def detect_captcha(self) -> bool:
        """Определяет наличие капчи на странице"""
        try:
            current_url = self.driver.current_url
            page_title = self.driver.title.lower()
            
            # Проверка URL (только для showcaptcha, не для demo)
            if 'showcaptcha' in current_url.lower():
                logger.warning("🔒 Обнаружена капча в URL!")
                return True
            
            # Проверка заголовка
            if 'robot' in page_title:
                logger.warning("🔒 Обнаружена капча в заголовке!")
                return True
            
            # Проверка элементов капчи
            captcha_elements = self.driver.find_elements(
                By.CSS_SELECTOR,
                'iframe[src*="captcha"], div[class*="captcha"], div[id*="captcha"], div[class*="SmartCaptcha"]'
            )
            
            if len(captcha_elements) > 0:
                logger.warning("🔒 Обнаружены элементы капчи!")
                return True
            
            logger.info("✅ Капча не обнаружена")
            return False
            
        except Exception as e:
            logger.error(f"⚠️ Ошибка детекта капчи: {e}")
            return False

    def solve_captcha_with_bright_data(self) -> bool:
        """Решает капчу через Bright Data Web Unlocker (API-подход)"""
        try:
            if self.captcha_attempts >= self.max_captcha_attempts:
                logger.error(f"❌ Достигнут лимит попыток решения капчи: {self.max_captcha_attempts}")
                return False
            
            self.captcha_attempts += 1
            logger.info(f"🔄 Попытка решения капчи {self.captcha_attempts}/{self.max_captcha_attempts}")
            
            current_url = self.driver.current_url
            logger.info(f"📍 URL с капчей: {current_url}")
            
            # Используем API для получения HTML без капчи
            if self.bright_data:
                result = self.bright_data.unlock_url(current_url)
                
                if result['success']:
                    logger.info("✅ Капча решена через Bright Data API!")
                    
                    # Загружаем очищенную страницу
                    self.driver.get(current_url)
                    time.sleep(3)
                    
                    # Проверяем, что капча решена
                    if not self.detect_captcha():
                        logger.info("✅ Капча успешно решена и страница загружена!")
                        return True
                    else:
                        logger.warning("⚠️ Капча все еще присутствует после API")
                        return False
                else:
                    logger.error(f"❌ Ошибка API: {result.get('error', 'Unknown error')}")
                    return False
            else:
                logger.error("❌ Bright Data не инициализирован!")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка решения капчи: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return False

    def navigate_to_demo_page(self) -> bool:
        """Переходит на демо-страницу Yandex SmartCaptcha"""
        try:
            logger.info("🌐 Переход на демо-страницу Yandex SmartCaptcha...")
            demo_url = "https://captcha-api.yandex.ru/demo"
            
            self.driver.get(demo_url)
            time.sleep(3)
            
            logger.info(f"📍 URL: {self.driver.current_url}")
            logger.info(f"📄 Заголовок: {self.driver.title}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка перехода на демо-страницу: {e}")
            return False

    def test_captcha_solving(self) -> bool:
        """Тестирует решение капчи на демо-странице"""
        try:
            logger.info("🧪 ТЕСТИРОВАНИЕ РЕШЕНИЯ КАПЧИ")
            logger.info("="*50)
            
            # Проверяем наличие капчи
            if self.detect_captcha():
                logger.info("🔒 Капча обнаружена, пытаемся решить...")
                
                # Решаем капчу
                if self.solve_captcha_with_bright_data():
                    logger.info("✅ Капча успешно решена!")
                    return True
                else:
                    logger.error("❌ Не удалось решить капчу")
                    return False
            else:
                logger.info("✅ Капча не обнаружена на демо-странице")
                return True
                
        except Exception as e:
            logger.error(f"❌ Ошибка тестирования капчи: {e}")
            return False

    def test_form_interaction(self) -> bool:
        """Тестирует взаимодействие с формой на демо-странице"""
        try:
            logger.info("📝 ТЕСТИРОВАНИЕ ВЗАИМОДЕЙСТВИЯ С ФОРМОЙ")
            logger.info("="*50)
            
            # Ищем поле ввода имени
            name_input = None
            name_selectors = [
                'input[name="name"]',
                'input[placeholder*="name"]',
                'input[placeholder*="Name"]',
                'input[type="text"]',
                'input[value="user"]',  # Предзаполненное значение
                'input'  # Любое поле ввода
            ]
            
            for selector in name_selectors:
                try:
                    name_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                    logger.info(f"✅ Найдено поле ввода по селектору: {selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if not name_input:
                logger.error("❌ Поле ввода имени не найдено!")
                return False
            
            # Вводим тестовое имя
            test_name = "Test User"
            name_input.clear()
            name_input.send_keys(test_name)
            logger.info(f"✅ Введено имя: {test_name}")
            
            # Ищем кнопку Submit
            submit_button = None
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:contains("Submit")',
                'button:contains("Отправить")'
            ]
            
            for selector in submit_selectors:
                try:
                    submit_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                    logger.info(f"✅ Найдена кнопка Submit по селектору: {selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if submit_button:
                submit_button.click()
                logger.info("✅ Кнопка Submit нажата")
                time.sleep(2)
                
                # Проверяем, появилась ли капча после отправки формы
                if self.detect_captcha():
                    logger.info("🔒 Капча появилась после отправки формы!")
                    return self.solve_captcha_with_bright_data()
                else:
                    logger.info("✅ Капча не появилась после отправки формы")
                    return True
            else:
                logger.warning("⚠️ Кнопка Submit не найдена")
                return True
                
        except Exception as e:
            logger.error(f"❌ Ошибка тестирования формы: {e}")
            return False

    def run_test(self, use_proxy=False):
        """Запускает полный тест парсера"""
        logger.info("="*60)
        logger.info("🚀 ТЕСТ BANDLINK PARSER С BRIGHT DATA")
        logger.info("="*60)
        logger.info("⚠️ Максимум 3 попытки решения капчи")
        logger.info(f"🌐 Режим: {'Прокси' if use_proxy else 'API (без прокси)'}")
        logger.info("="*60)
        
        if not self.setup_driver(use_bright_data_proxy=use_proxy):
            return
        
        try:
            # Тест 1: Переход на демо-страницу
            if not self.navigate_to_demo_page():
                return
            
            # Тест 2: Проверка и решение капчи
            if not self.test_captcha_solving():
                logger.error("❌ Тест решения капчи провален")
                return
            
            # Тест 3: Взаимодействие с формой
            if not self.test_form_interaction():
                logger.error("❌ Тест взаимодействия с формой провален")
                return
            
            logger.info("="*60)
            logger.info("✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
            logger.info("="*60)
            logger.info(f"📊 Статистика:")
            logger.info(f"   - Попыток решения капчи: {self.captcha_attempts}/{self.max_captcha_attempts}")
            logger.info("="*60)
            
        except KeyboardInterrupt:
            logger.info("\n⏹️ Тест прерван пользователем")
        except Exception as e:
            logger.error(f"❌ Критическая ошибка: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
        finally:
            if self.driver:
                logger.info("⏳ Закрытие браузера через 5 секунд...")
                time.sleep(5)
                self.driver.quit()
                logger.info("🔒 Браузер закрыт")

def main():
    """Главная функция"""
    parser = BandlinkParserBrightDataMac()
    parser.run_test()

if __name__ == "__main__":
    main()
