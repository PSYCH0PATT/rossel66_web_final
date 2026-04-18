#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест Browser API с Playwright (async) для решения Yandex SmartCaptcha
Основан на официальной документации Bright Data
"""

import asyncio
import logging
import os
import sys

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
except ImportError:
    logger.error("❌ Playwright не установлен!")
    logger.error("Установите: pip install playwright")
    logger.error("Затем: playwright install")
    sys.exit(1)

def _bright_data_auth() -> str:
    direct = (os.environ.get("BRIGHT_DATA_PROXY_AUTH") or "").strip()
    if direct:
        return direct
    u = os.environ.get("BRIGHT_DATA_WEB_UNLOCKER_USERNAME") or os.environ.get(
        "BRIGHT_DATA_RESIDENTIAL_USERNAME", ""
    )
    p = os.environ.get("BRIGHT_DATA_WEB_UNLOCKER_PASSWORD") or os.environ.get(
        "BRIGHT_DATA_RESIDENTIAL_PASSWORD", ""
    )
    suffix = os.environ.get("BRIGHT_DATA_PROXY_COUNTRY_SUFFIX", "-country-us")
    if u and p:
        return f"{u}{suffix}:{p}"
    raise SystemExit(
        "Задайте BRIGHT_DATA_PROXY_AUTH или WEB_UNLOCKER/RESIDENTIAL USERNAME+PASSWORD"
    )


AUTH = _bright_data_auth()
TARGET_URL = "https://captcha-api.yandex.ru/demo"

async def test_captcha_solve():
    """Тестирует решение Yandex SmartCaptcha через Browser API"""
    logger.info("="*60)
    logger.info("🧪 ASYNC ТЕСТ BROWSER API С YANDEX SMARTCAPTCHA")
    logger.info("="*60)
    logger.info(f"🔗 AUTH: {AUTH[:50]}...")
    logger.info(f"🌐 URL: {TARGET_URL}")
    
    try:
        # Запускаем Playwright
        logger.info("🚀 Запуск Playwright (async)...")
        playwright = await async_playwright().start()
        logger.info("✅ Playwright запущен")
        
        # Подключаемся к Browser API
        browser_ws_endpoint = f"wss://{AUTH}@brd.superproxy.io:9222"
        logger.info(f"🌐 Подключение к Browser API...")
        logger.info(f"   WebSocket: {browser_ws_endpoint[:60]}...")
        
        browser_instance = await playwright.chromium.connect_over_cdp(browser_ws_endpoint)
        logger.info("✅ Подключено к удаленному браузеру!")
        
        try:
            # Создаем новую страницу
            page = await browser_instance.new_page()
            logger.info("✅ Страница создана")
            
            # Переходим на демо-страницу
            logger.info(f"🌐 Переход на: {TARGET_URL}")
            await page.goto(TARGET_URL, timeout=120000)
            logger.info("✅ Страница загружена!")
            
            # Ждем появления формы
            logger.info("⏳ Ожидание появления формы...")
            await page.wait_for_selector('input[name="name"]', timeout=10000)
            logger.info("✅ Форма найдена!")
            
            # Проверяем наличие капчи
            logger.info("🔍 Проверка наличия капчи на странице...")
            captcha_iframe = await page.query_selector('iframe[src*="captcha"]')
            captcha_div = await page.query_selector('[class*="SmartCaptcha"]')
            
            if captcha_iframe or captcha_div:
                logger.info("🔒 Капча обнаружена визуально!")
            else:
                logger.info("⚠️ Капча не обнаружена визуально")
            
            # Создаем CDP сессию
            logger.info("🔧 Создание CDP сессии...")
            client = await page.context.new_cdp_session(page)
            logger.info("✅ CDP сессия создана")
            
            # Запускаем Captcha.solve (правильный метод!)
            logger.info("🔓 Запуск Captcha.solve с detectTimeout=30000...")
            logger.info("⏳ Ожидание автоматического решения капчи...")
            
            solve_result = await client.send('Captcha.solve', {
                'detectTimeout': 30000  # 30 секунд на обнаружение и решение
            })
            
            logger.info("="*60)
            logger.info(f"📊 Captcha.solve результат: {solve_result}")
            logger.info("="*60)
            
            status = solve_result.get('status')
            logger.info(f"📊 Статус капчи: {status}")
            
            if status == 'solve_finished':
                logger.info("🎉 Капча решена автоматически!")
            elif status == 'not_detected':
                logger.warning("⚠️ Капча не обнаружена Browser API")
            elif status == 'solve_failed':
                logger.error("❌ Решение капчи провалено")
            else:
                logger.warning(f"⚠️ Неизвестный статус: {status}")
            
            # Ждем немного после попытки решения
            logger.info("⏳ Ожидание 3 секунды...")
            await page.wait_for_timeout(3000)
            
            # Проверяем результат
            logger.info("🔍 Проверка финального результата...")
            content = await page.content()
            page_title = await page.title()
            page_url = page.url
            
            logger.info(f"📄 Заголовок: {page_title}")
            logger.info(f"📄 URL: {page_url}")
            
            if 'Hello, user!' in content or 'Привет, user!' in content:
                logger.info("="*60)
                logger.info("🎉 УСПЕХ! Капча решена и форма отправлена!")
                logger.info("✅ Найден текст 'Hello, user!' на странице")
                logger.info("="*60)
                return True
            elif 'captcha' in content.lower():
                logger.warning("⚠️ Страница все еще содержит капчу")
                
                # Делаем скриншот
                try:
                    screenshot_path = '/tmp/captcha_async_test.png'
                    await page.screenshot(path=screenshot_path)
                    logger.info(f"📸 Скриншот сохранен: {screenshot_path}")
                except Exception as e:
                    logger.error(f"❌ Не удалось сделать скриншот: {e}")
                
                return False
            else:
                logger.info("⚠️ 'Hello, user!' не найден, но капчи тоже нет")
                return False
            
        finally:
            logger.info("🔒 Закрытие браузера...")
            await browser_instance.close()
            logger.info("✅ Браузер закрыт")
            
            await playwright.stop()
            logger.info("✅ Playwright остановлен")
    
    except PlaywrightTimeoutError as e:
        logger.error(f"❌ Таймаут: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        import traceback
        logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
        return False

async def main():
    """Главная функция"""
    success = await test_captcha_solve()
    
    if success:
        logger.info("="*60)
        logger.info("✅ ТЕСТ ПРОЙДЕН УСПЕШНО!")
        logger.info("="*60)
        return 0
    else:
        logger.error("="*60)
        logger.error("❌ ТЕСТ ПРОВАЛЕН!")
        logger.error("="*60)
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

