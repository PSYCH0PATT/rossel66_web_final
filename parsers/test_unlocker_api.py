#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест Bright Data Web Unlocker API для решения Yandex SmartCaptcha
"""

import requests
import json
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Данные из панели Bright Data
API_KEY = "4d65b7184094d3f99a670ab198fe0e8ce2116d52c66b05887aafe6fecb075a70"
ZONE = "web_unlocker1"
BASE_URL = "https://api.brightdata.com/request"

def test_yandex_demo():
    """Тестирует Web Unlocker API на демо-странице Yandex SmartCaptcha"""
    logger.info("="*60)
    logger.info("🧪 ТЕСТ WEB UNLOCKER API С YANDEX SMARTCAPTCHA DEMO")
    logger.info("="*60)
    
    # URL демо-страницы с капчей
    target_url = "https://captcha-api.yandex.ru/demo"
    
    payload = {
        "url": target_url,
        "zone": ZONE,
        "format": "raw",  # Получаем HTML
        "country": "us"   # США для обхода блокировки .ru
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        logger.info(f"📤 Отправка запроса к Web Unlocker API...")
        logger.info(f"   URL: {target_url}")
        logger.info(f"   Zone: {ZONE}")
        logger.info(f"   Country: us")
        logger.info(f"   API Key: {API_KEY[:20]}...")
        
        response = requests.post(
            BASE_URL,
            headers=headers,
            json=payload,
            timeout=120  # 2 минуты на решение капчи
        )
        
        logger.info(f"📊 Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            html = response.text
            logger.info(f"✅ Успешно! Получено HTML: {len(html)} символов")
            
            # Проверяем результат
            if 'Hello, user!' in html or 'Привет, user!' in html:
                logger.info("="*60)
                logger.info("🎉 УСПЕХ! Капча решена!")
                logger.info("✅ Найден текст 'Hello, user!' в HTML")
                logger.info("="*60)
                return True
            elif 'captcha' in html.lower() or 'showcaptcha' in html.lower():
                logger.warning("⚠️ В HTML все еще присутствует капча")
                logger.warning("Первые 500 символов HTML:")
                logger.warning(html[:500])
                return False
            else:
                logger.warning("⚠️ 'Hello, user!' не найден")
                logger.warning("Первые 500 символов HTML:")
                logger.warning(html[:500])
                return False
        else:
            error_text = response.text
            logger.error(f"❌ Ошибка {response.status_code}")
            logger.error(f"Ответ: {error_text}")
            return False
    
    except requests.exceptions.Timeout:
        logger.error("❌ Таймаут запроса (120 секунд)")
        return False
    
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Ошибка HTTP: {e}")
        return False
    
    except Exception as e:
        logger.error(f"❌ Неизвестная ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def test_bandlink_search():
    """Тестирует Web Unlocker API на поиске в Bandlink"""
    logger.info("="*60)
    logger.info("🧪 ТЕСТ WEB UNLOCKER API С BANDLINK SEARCH")
    logger.info("="*60)
    
    # URL поиска артиста
    target_url = "https://band.link/scanner?search=Sour+Diesel"
    
    payload = {
        "url": target_url,
        "zone": ZONE,
        "format": "raw",
        "country": "us"
    }
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        logger.info(f"📤 Отправка запроса к Web Unlocker API...")
        logger.info(f"   URL: {target_url}")
        
        response = requests.post(
            BASE_URL,
            headers=headers,
            json=payload,
            timeout=120
        )
        
        logger.info(f"📊 Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            html = response.text
            logger.info(f"✅ Успешно! Получено HTML: {len(html)} символов")
            
            # Проверяем, нет ли капчи
            if 'captcha' in html.lower() or 'showcaptcha' in html.lower():
                logger.warning("⚠️ В HTML присутствует капча!")
                return False
            
            # Ищем результаты поиска
            if 'spotify' in html.lower() or 'apple' in html.lower() or 'youtube' in html.lower():
                logger.info("="*60)
                logger.info("🎉 УСПЕХ! Найдены результаты поиска!")
                logger.info("✅ Обнаружены ссылки на плейлисты")
                logger.info("="*60)
                return True
            else:
                logger.warning("⚠️ Результаты поиска не найдены")
                logger.warning("Первые 500 символов HTML:")
                logger.warning(html[:500])
                return False
        else:
            error_text = response.text
            logger.error(f"❌ Ошибка {response.status_code}")
            logger.error(f"Ответ: {error_text}")
            return False
    
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

def main():
    """Главная функция"""
    logger.info("🚀 Запуск тестов Web Unlocker API")
    logger.info("")
    
    # Тест 1: Yandex SmartCaptcha Demo
    test1_passed = test_yandex_demo()
    logger.info("")
    
    # Тест 2: Bandlink Search
    test2_passed = test_bandlink_search()
    logger.info("")
    
    # Итоги
    logger.info("="*60)
    logger.info("📊 ИТОГИ ТЕСТИРОВАНИЯ")
    logger.info("="*60)
    logger.info(f"Тест 1 (Yandex Demo): {'✅ ПРОЙДЕН' if test1_passed else '❌ ПРОВАЛЕН'}")
    logger.info(f"Тест 2 (Bandlink Search): {'✅ ПРОЙДЕН' if test2_passed else '❌ ПРОВАЛЕН'}")
    logger.info("="*60)
    
    if test1_passed and test2_passed:
        logger.info("🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!")
        logger.info("✅ Web Unlocker API работает корректно!")
        logger.info("✅ Yandex SmartCaptcha решается автоматически!")
        sys.exit(0)
    else:
        logger.error("❌ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ!")
        sys.exit(1)

if __name__ == "__main__":
    main()

