#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для запуска Mac-версии Bandlink парсера
"""

import os
import sys
import json
import shutil
from pathlib import Path

def setup_test_environment():
    """Настраивает тестовое окружение"""
    print("🔧 Настройка тестового окружения для Mac...")
    
    captcha_key = os.environ.get("TWOCAPTCHA_API_KEY", "").strip()
    if not captcha_key:
        print("❌ Задайте TWOCAPTCHA_API_KEY в окружении")
        sys.exit(1)

    # Создаем тестовый конфиг со всеми артистами
    test_config = {
        "target_artists": ["Wide Pie", "Sour Diesel", "Lover"],  # Все артисты
        "captcha_api_key": captcha_key,
    }
    
    config_path = "temp_bandlink_config.json"
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(test_config, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Создан тестовый конфиг: {config_path}")
    return config_path

def check_dependencies():
    """Проверяет зависимости"""
    print("🔍 Проверка зависимостей...")
    
    try:
        import selenium
        print(f"✅ Selenium: {selenium.__version__}")
    except ImportError:
        print("❌ Selenium не установлен!")
        print("💡 Установите: pip install selenium")
        return False
    
    try:
        from twocaptcha import TwoCaptcha
        print("✅ 2captcha-python установлен")
    except ImportError:
        print("❌ 2captcha-python не установлен!")
        print("💡 Установите: pip install 2captcha-python")
        return False
    
    # Проверяем Chrome
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        
        driver = webdriver.Chrome(options=options)
        driver.quit()
        print("✅ Chrome WebDriver работает")
    except Exception as e:
        print(f"❌ Chrome WebDriver не работает: {e}")
        print("💡 Установите Chrome и chromedriver")
        return False
    
    return True

def run_mac_parser():
    """Запускает Mac-версию парсера"""
    print("🚀 Запуск Mac-версии Bandlink парсера...")
    
    # Импортируем и запускаем парсер
    try:
        from bandlink_parser_mac import BandlinkParserMac
        
        parser = BandlinkParserMac("temp_bandlink_config.json")
        success = parser.run_parsing_cycle()
        
        if success:
            print("✅ Тест завершен успешно!")
        else:
            print("❌ Тест завершен с ошибками")
            
        return success
        
    except Exception as e:
        print(f"❌ Ошибка запуска парсера: {e}")
        import traceback
        print(f"🔍 Трассировка: {traceback.format_exc()}")
        return False

def main():
    """Главная функция"""
    print("=" * 60)
    print("🍎 Mac Test Environment для Bandlink Parser")
    print("=" * 60)
    
    # Проверяем зависимости
    if not check_dependencies():
        print("❌ Не все зависимости установлены!")
        return
    
    # Настраиваем окружение
    config_path = setup_test_environment()
    
    # Запускаем парсер
    success = run_mac_parser()
    
    # Очищаем временные файлы
    if os.path.exists(config_path):
        os.remove(config_path)
        print(f"🧹 Удален временный конфиг: {config_path}")
    
    if os.path.exists("bandlink_playlists_mac.db"):
        print(f"📊 База данных создана: bandlink_playlists_mac.db")
    
    print("=" * 60)
    if success:
        print("🎉 Тест прошел успешно!")
    else:
        print("❌ Тест завершился с ошибками")
    print("=" * 60)

if __name__ == "__main__":
    main()
