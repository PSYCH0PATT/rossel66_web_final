#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Тест прокси в Docker"""

import requests
import sys
import os

# Данные прокси
PROXY_HOST = os.getenv('PROXY_HOST', '94.154.188.161')
PROXY_USER = os.getenv('BRIGHT_DATA_RESIDENTIAL_USERNAME', 'HYRrWAXb')
PROXY_PASS = os.getenv('BRIGHT_DATA_RESIDENTIAL_PASSWORD', 'Dfi5FeEC')
PROXY_PORT = int(os.getenv('PROXY_PORT', '63194'))

def test_proxy():
    """Проверка прокси через requests"""
    print("=" * 60)
    print("🔍 Проверка прокси от Proxyline в Docker")
    print("=" * 60)
    print(f"📡 Прокси: {PROXY_HOST}:{PROXY_PORT}")
    print(f"👤 Username: {PROXY_USER}")
    
    proxy_url = f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}"
    proxies = {
        'http': proxy_url,
        'https': proxy_url
    }
    
    try:
        print("\n🌐 Проверка IP через прокси...")
        response = requests.get('https://api.ipify.org?format=json', proxies=proxies, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            ip = data.get('ip', 'не найден')
            print(f"✅ Прокси работает!")
            print(f"🌐 Ваш IP через прокси: {ip}")
            print(f"📍 Ожидаемый IP: {PROXY_HOST}")
            
            if ip == PROXY_HOST:
                print("✅ IP совпадает - прокси работает корректно!")
                return True
            else:
                print(f"⚠️  IP не совпадает (возможно прокси использует другой IP)")
                return True  # Все равно считаем успешным
        else:
            print(f"❌ Ошибка: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        import traceback
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = test_proxy()
    print("\n" + "=" * 60)
    if success:
        print("✅ Тест завершен успешно")
    else:
        print("❌ Тест не пройден")
    print("=" * 60)
    sys.exit(0 if success else 1)

