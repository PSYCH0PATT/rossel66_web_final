#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
БЕЗОПАСНАЯ версия Bandlink Parser с защитой от множественных запросов к 2captcha
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
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

try:
    from twocaptcha import TwoCaptcha
    TWOCAPTCHA_AVAILABLE = True
except ImportError:
    print("⚠️ 2captcha-python не установлен.")
    TWOCAPTCHA_AVAILABLE = False

class SafeBandlinkParser:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists.db'
        self.driver = None
        self.captcha_solver = None
        
        # ЗАЩИТА: Счетчики для предотвращения множественных запросов
        self.captcha_attempts = 0
        self.max_captcha_attempts = 3  # Максимум 3 попытки решения капчи
        self.captcha_requests_count = 0  # Счетчик запросов к 2captcha
        self.max_captcha_requests = 10  # Максимум 10 запросов за сессию
        
        self.init_database()
        self.init_captcha_solver()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        print(f"🔍 Загрузка конфига: {self.config_file}")
        
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    print(f"✅ Конфиг загружен: {list(config.keys())}")
                    return config
            except Exception as e:
                print(f"❌ Ошибка загрузки конфигурации: {e}")
        
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
            print(f"✅ База данных инициализирована")
        except Exception as e:
            print(f"❌ Ошибка инициализации базы данных: {e}")
    
    def init_captcha_solver(self):
        """Инициализирует 2captcha solver"""
        api_key = self.config.get('captcha_api_key')
        
        if api_key and TWOCAPTCHA_AVAILABLE:
            try:
                self.captcha_solver = TwoCaptcha(api_key)
                print(f"✅ 2captcha инициализирован")
            except Exception as e:
                print(f"❌ Ошибка инициализации 2captcha: {e}")
                self.captcha_solver = None
        else:
            print("⚠️ 2captcha не настроен")
    
    def detect_captcha(self) -> bool:
        """Определяет наличие Yandex SmartCaptcha"""
        try:
            # Ищем iframe с капчей
            captcha_iframes = self.driver.find_elements(
                By.CSS_SELECTOR, 
                'iframe[src*="smartcaptcha"], iframe[src*="captcha-api.yandex"]'
            )
            
            if len(captcha_iframes) > 0:
                print("🔍 Обнаружена Yandex SmartCaptcha!")
                return True
            
            return False
            
        except Exception as e:
            print(f"⚠️ Ошибка детекта капчи: {e}")
            return False
    
    def solve_yandex_smartcaptcha(self) -> bool:
        """
        БЕЗОПАСНОЕ решение Yandex SmartCaptcha
        С защитой от множественных запросов
        """
        # ЗАЩИТА 1: Проверка счетчика попыток
        if self.captcha_attempts >= self.max_captcha_attempts:
            print(f"❌ ЗАЩИТА: Превышен лимит попыток решения капчи ({self.max_captcha_attempts})")
            print("⚠️ Остановка парсера для безопасности")
            return False
        
        # ЗАЩИТА 2: Проверка общего количества запросов
        if self.captcha_requests_count >= self.max_captcha_requests:
            print(f"❌ ЗАЩИТА: Превышен лимит запросов к 2captcha ({self.max_captcha_requests})")
            print("⚠️ Остановка парсера для безопасности")
            return False
        
        if not self.captcha_solver:
            print("❌ 2captcha не настроен!")
            return False
        
        try:
            self.captcha_attempts += 1
            print(f"🔄 Попытка решения капчи {self.captcha_attempts}/{self.max_captcha_attempts}")
            
            current_url = self.driver.current_url
            print(f"📍 URL: {current_url}")
            
            # Получаем sitekey (как в GitHub проекте)
            print("🔍 Получаем sitekey...")
            try:
                sitekey = self.driver.execute_script("""
                    var container = document.querySelector('[data-sitekey]');
                    if (container) {
                        return container.getAttribute('data-sitekey');
                    }
                    return null;
                """)
                
                if not sitekey:
                    print("❌ Sitekey не найден на странице!")
                    return False
                
                print(f"✅ Sitekey найден: {sitekey[:20]}...")
                
            except Exception as e:
                print(f"❌ Ошибка получения sitekey: {e}")
                return False
            
            # ЗАЩИТА 3: Увеличиваем счетчик ПЕРЕД отправкой
            self.captcha_requests_count += 1
            print(f"📊 Запрос к 2captcha #{self.captcha_requests_count}/{self.max_captcha_requests}")
            
            # Отправляем в 2captcha (используем метод yandexSmart если доступен)
            print(f"📤 Отправляем капчу в 2captcha...")
            print(f"⏳ Ожидаем решения (20-60 секунд)...")
            
            try:
                # Пробуем использовать метод yandexSmart
                result = self.captcha_solver.yandexSmart(
                    pageurl=current_url,
                    sitekey=sitekey
                )
                
                token = result.get('code')
                
                if not token:
                    print(f"❌ Не получен токен от 2captcha!")
                    print(f"🔍 Ответ 2captcha: {result}")
                    return False
                
                print(f"✅ Капча решена! Токен получен")
                
                # Вставляем токен в поле (как в GitHub проекте)
                print("🔧 Вставляем токен в поле...")
                self.driver.execute_script(f"""
                    var tokenInput = document.querySelector('input[data-testid="smart-token"]') 
                                  || document.querySelector('input[name="smart-token"]')
                                  || document.querySelector('input[type="hidden"]');
                    if (tokenInput) {{
                        tokenInput.value = '{token}';
                        console.log('Token inserted');
                    }}
                """)
                
                time.sleep(2)
                print("✅ Yandex SmartCaptcha решена успешно!")
                return True
                
            except AttributeError:
                print("⚠️ Метод yandexSmart не доступен в библиотеке 2captcha-python")
                print("💡 Используйте библиотеку 2captcha-ts или обновите 2captcha-python")
                return False
            except Exception as e:
                print(f"❌ Ошибка решения капчи: {e}")
                import traceback
                print(f"🔍 Трассировка: {traceback.format_exc()}")
                return False
            
        except Exception as e:
            print(f"❌ Критическая ошибка решения капчи: {e}")
            return False
    
    def setup_driver(self):
        """Настраивает WebDriver"""
        try:
            print("🔧 Настройка Chrome драйвера...")
            
            options = Options()
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--headless')
            options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            print("✅ Chrome драйвер настроен")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка настройки драйвера: {e}")
            return False
    
    def navigate_to_scanner(self) -> bool:
        """Переходит на страницу сканера"""
        try:
            print("🌐 Переход на band.link/scanner...")
            self.driver.get('https://band.link/scanner')
            time.sleep(random.uniform(3, 6))
            
            print(f"📍 URL: {self.driver.current_url}")
            
            # Проверяем капчу ОДИН РАЗ
            if self.detect_captcha():
                print("🔒 Капча обнаружена! Пытаемся решить...")
                if not self.solve_yandex_smartcaptcha():
                    print("❌ Не удалось решить капчу!")
                    return False
            
            print("✅ Страница загружена успешно")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка перехода на страницу: {e}")
            return False
    
    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("="*60)
        print("🚀 БЕЗОПАСНАЯ версия Bandlink парсера")
        print(f"🛡️ Защита: макс {self.max_captcha_attempts} попыток капчи")
        print(f"🛡️ Защита: макс {self.max_captcha_requests} запросов к 2captcha")
        print("="*60)
        
        if not self.setup_driver():
            return False
        
        try:
            if not self.navigate_to_scanner():
                print("❌ Ошибка перехода на страницу")
                return False
            
            artists = self.config.get('target_artists', [])
            if not artists:
                print("❌ Список артистов не настроен!")
                return False
            
            print(f"📋 Начинаем парсинг {len(artists)} артистов...")
            
            for i, artist in enumerate(artists, 1):
                print(f"\n{'='*50}")
                print(f"Артист {i}/{len(artists)}: {artist}")
                
                # Здесь будет логика парсинга артиста
                # TODO: Добавить парсинг плейлистов
                
                if i < len(artists):
                    delay = random.uniform(10, 20)
                    print(f"⏳ Пауза {delay:.1f} секунд...")
                    time.sleep(delay)
            
            print("\n✅ Парсинг завершен!")
            print(f"📊 Статистика:")
            print(f"  - Попыток решения капчи: {self.captcha_attempts}")
            print(f"  - Запросов к 2captcha: {self.captcha_requests_count}")
            
            return True
            
        finally:
            if self.driver:
                self.driver.quit()
                print("🔒 WebDriver закрыт")

def main():
    """Главная функция"""
    print("="*60)
    print("🛡️ БЕЗОПАСНАЯ версия Bandlink Parser")
    print("="*60)
    
    config_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not config_file:
        print("❌ Не указан конфиг файл!")
        print("💡 Использование: python3 bandlink_parser_safe.py <config_file>")
        return
    
    parser = SafeBandlinkParser(config_file)
    success = parser.run_parsing_cycle()
    
    if success:
        print("✅ Парсинг завершен успешно!")
    else:
        print("❌ Парсинг завершен с ошибками")

if __name__ == "__main__":
    main()

