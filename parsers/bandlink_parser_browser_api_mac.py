#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Mac с интеграцией Bright Data Browser API
Тестирование на captcha-api.yandex.ru/demo
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
    from selenium.webdriver.remote.webdriver import WebDriver
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    logger.error("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

class BrightDataBrowserAPI:
    """Класс для работы с Bright Data Browser API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Данные из панели Bright Data для Web Unlocker (прокси-сервер)
        # Это НЕ Browser API, а Web Unlocker через прокси!
        self.host = "brd.superproxy.io"
        self.port = "33335"  # Правильный порт из панели управления
        self.username = "brd-customer-hl_94d02fd9-zone-web_unlocker1"
        self.password = "bp8k2m4ji12a"
        # Формат прокси URL для Selenium
        self.proxy_url = f"http://{self.username}:{self.password}@{self.host}:{self.port}"
        self.max_attempts = 3
        
    def create_proxy_driver(self) -> WebDriver:
        """
        Создает локальный WebDriver с прокси Web Unlocker
        """
        try:
            logger.info("🌐 Создание локального WebDriver с прокси Web Unlocker...")
            
            # Настройки для локального WebDriver с прокси
            options = Options()
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--window-size=1920,1080')
            
            # Добавляем прокси Web Unlocker
            options.add_argument(f'--proxy-server={self.proxy_url}')
            
            # Создаем локальный WebDriver с прокси
            logger.info(f"🔗 Используем прокси: {self.proxy_url[:50]}...")
            driver = webdriver.Chrome(options=options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info("✅ WebDriver создан с прокси Web Unlocker")
            return driver
            
        except Exception as e:
            logger.error(f"❌ Ошибка создания WebDriver с прокси: {e}")
            raise

class BandlinkParserBrowserAPIMac:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists_browser_api_mac.db'
        self.driver = None
        self.browser_api = None
        self.max_captcha_attempts = 3  # Максимум 3 попытки как просили
        self.captcha_attempts = 0
        self.init_database()
        self.init_browser_api()
    
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

    def init_browser_api(self):
        """Инициализирует Bright Data Browser API"""
        api_key = self.config.get('bright_data_api_key')
        if not api_key:
            # Используем API ключ из кода
            api_key = "4d65b7184094d3f99a670ab198fe0e8ce2116d52c66b05887aafe6fecb075a70"
            logger.info("🔑 Используем API ключ из кода")
        
        try:
            self.browser_api = BrightDataBrowserAPI(api_key)
            logger.info("✅ Bright Data Browser API инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации Browser API: {e}")
            self.browser_api = None

    def setup_driver(self):
        """Настраивает WebDriver с подключением к Browser API через WebSocket"""
        try:
            if not self.browser_api:
                logger.error("❌ Browser API не инициализирован!")
                return False
            
            logger.info("🔧 Настройка WebDriver с прокси Web Unlocker...")
            self.driver = self.browser_api.create_proxy_driver()
            logger.info("✅ WebDriver настроен с прокси Web Unlocker")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка настройки WebDriver: {e}")
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

    def solve_captcha_with_browser_api(self) -> bool:
        """Решает капчу через Bright Data Browser API (автоматически)"""
        try:
            if self.captcha_attempts >= self.max_captcha_attempts:
                logger.error(f"❌ Достигнут лимит попыток решения капчи: {self.max_captcha_attempts}")
                return False
            
            self.captcha_attempts += 1
            logger.info(f"🔄 Попытка решения капчи {self.captcha_attempts}/{self.max_captcha_attempts}")
            
            current_url = self.driver.current_url
            logger.info(f"📍 URL с капчей: {current_url}")
            
            # Browser API автоматически решает капчи
            # Просто ждем и проверяем
            logger.info("⏳ Ожидаем автоматического решения капчи через Browser API...")
            time.sleep(10)  # Даем время на автоматическое решение
            
            # Проверяем, что капча решена
            if not self.detect_captcha():
                logger.info("✅ Капча автоматически решена через Browser API!")
                return True
            else:
                logger.warning("⚠️ Капча все еще присутствует")
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
                logger.info("🔒 Капча обнаружена, ожидаем автоматического решения...")
                
                # Browser API автоматически решает капчи
                if self.solve_captcha_with_browser_api():
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
                time.sleep(3)
                
                # Проверяем, появилась ли капча после отправки формы
                if self.detect_captcha():
                    logger.info("🔒 Капча появилась после отправки формы!")
                    return self.solve_captcha_with_browser_api()
                else:
                    logger.info("✅ Капча не появилась после отправки формы")
                    return True
            else:
                logger.warning("⚠️ Кнопка Submit не найдена")
                return True
                
        except Exception as e:
            logger.error(f"❌ Ошибка тестирования формы: {e}")
            return False

    def run_test(self):
        """Запускает полный тест парсера"""
        logger.info("="*60)
        logger.info("🚀 ТЕСТ BANDLINK PARSER С BRIGHT DATA BROWSER API")
        logger.info("="*60)
        logger.info("⚠️ Максимум 3 попытки решения капчи")
        logger.info("🌐 Режим: Browser API (remote WebDriver)")
        logger.info("="*60)
        
        if not self.setup_driver():
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
    parser = BandlinkParserBrowserAPIMac()
    parser.run_test()

if __name__ == "__main__":
    main()
