#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка прокси от Proxyline"""

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Данные прокси
PROXY_HOST = "94.154.188.161"
PROXY_USER = "HYRrWAXb"
PROXY_PASS = "Dfi5FeEC"
PROXY_PORT_HTTP = 63194
PROXY_PORT_SOCKS5 = 63195

def test_proxy_requests():
    """Проверка прокси через requests"""
    print("=" * 60)
    print("🔍 Проверка прокси через requests")
    print("=" * 60)
    
    proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT_HTTP}"
    proxies = {
        'http': proxy_url,
        'https': proxy_url
    }
    
    try:
        print(f"📡 Подключение к прокси: {PROXY_HOST}:{PROXY_PORT_HTTP}")
        response = requests.get('https://api.ipify.org?format=json', proxies=proxies, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Прокси работает!")
            print(f"🌐 Ваш IP через прокси: {data['ip']}")
            print(f"📍 Ожидаемый IP: {PROXY_HOST}")
            
            if data['ip'] == PROXY_HOST:
                print("✅ IP совпадает - прокси работает корректно!")
            else:
                print(f"⚠️  IP не совпадает (возможно прокси использует другой IP)")
            
            return True
        else:
            print(f"❌ Ошибка: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        return False

def test_proxy_selenium():
    """Проверка прокси через Selenium"""
    print("\n" + "=" * 60)
    print("🔍 Проверка прокси через Selenium")
    print("=" * 60)
    
    try:
        options = Options()
        
        # Настройка прокси
        proxy_url = f"{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT_HTTP}"
        options.add_argument(f'--proxy-server=http://{proxy_url}')
        
        # Основные настройки
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        print(f"📡 Подключение к прокси: {PROXY_HOST}:{PROXY_PORT_HTTP}")
        print("🚀 Запуск Chrome...")
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        print("✅ Chrome запущен с прокси")
        print("🌐 Переход на страницу проверки IP...")
        
        driver.get('https://api.ipify.org?format=json')
        time.sleep(2)
        
        page_text = driver.page_source
        print(f"📄 Ответ страницы: {page_text[:200]}")
        
        # Парсим JSON из ответа
        import json
        import re
        json_match = re.search(r'\{[^}]+\}', page_text)
        if json_match:
            data = json.loads(json_match.group())
            ip = data.get('ip', 'не найден')
            print(f"🌐 Ваш IP через прокси: {ip}")
            print(f"📍 Ожидаемый IP: {PROXY_HOST}")
            
            if ip == PROXY_HOST:
                print("✅ IP совпадает - прокси работает корректно!")
            else:
                print(f"⚠️  IP не совпадает (возможно прокси использует другой IP)")
        
        # Проверяем доступность сайта
        print("\n🌐 Проверка доступа к band.link...")
        driver.get('https://band.link')
        time.sleep(3)
        
        if 'band.link' in driver.current_url or 'band' in driver.title.lower():
            print("✅ Доступ к band.link успешен!")
        else:
            print(f"⚠️  Неожиданный URL: {driver.current_url}")
            print(f"📄 Title: {driver.title}")
        
        driver.quit()
        print("🔒 Браузер закрыт")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    import time
    
    # Проверка через requests
    test_proxy_requests()
    
    # Проверка через Selenium
    test_proxy_selenium()
    
    print("\n" + "=" * 60)
    print("✅ Проверка завершена")
    print("=" * 60)

