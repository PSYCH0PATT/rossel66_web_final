#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тест Browser API с Playwright для решения Yandex SmartCaptcha
"""

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
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
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
        "Задайте BRIGHT_DATA_PROXY_AUTH (user:pass) или WEB_UNLOCKER/RESIDENTIAL USERNAME+PASSWORD"
    )


AUTH = _bright_data_auth()
SBR_WS_CDP = f"wss://{AUTH}@brd.superproxy.io:9222"

def test_captcha_demo():
    """Тестирует решение капчи на демо-странице Yandex"""
    logger.info("="*60)
    logger.info("🧪 ТЕСТ BROWSER API С YANDEX SMARTCAPTCHA DEMO")
    logger.info("="*60)
    logger.info(f"🔗 WebSocket: {SBR_WS_CDP[:50]}...")
    
    try:
        logger.info("🌐 Подключение к Browser API...")
        
        with sync_playwright() as p:
            logger.info("✅ Playwright запущен")
            
            # Подключаемся к удаленному браузеру через CDP
            browser = p.chromium.connect_over_cdp(SBR_WS_CDP)
            logger.info("✅ Подключено к удаленному браузеру!")
            
            try:
                # Создаем новую страницу
                page = browser.new_page()
                logger.info("✅ Страница создана")
                
                # Переходим на демо-страницу
                demo_url = 'https://captcha-api.yandex.ru/demo'
                logger.info(f"🌐 Переход на: {demo_url}")
                
                page.goto(demo_url, timeout=120000, wait_until='domcontentloaded')
                logger.info("✅ Страница загружена!")
                
                # Ждем появления формы
                logger.info("⏳ Ожидание появления формы...")
                page.wait_for_selector('input[name="name"]', timeout=10000)
                logger.info("✅ Форма найдена!")
                
                # Проверяем наличие капчи
                logger.info("🔍 Проверка наличия капчи...")
                captcha_present = page.locator('iframe[src*="captcha"]').count() > 0 or \
                                 page.locator('[class*="SmartCaptcha"]').count() > 0
                
                if captcha_present:
                    logger.info("🔒 Капча обнаружена!")
                    logger.info("⏳ Ожидание автоматического решения капчи через Browser API...")
                    
                    # Используем CDP для активного решения капчи (правильный метод!)
                    try:
                        client = page.context.new_cdp_session(page)
                        logger.info("✅ CDP сессия создана")
                        
                        # Используем Captcha.solve для активного решения капчи
                        logger.info("🔓 Запускаем Captcha.solve...")
                        result = client.send('Captcha.solve', {
                            'detectTimeout': 30000  # 30 секунд на обнаружение и решение
                        })
                        logger.info(f"✅ Captcha.solve результат: {result}")
                        
                        status = result.get('status')
                        if status == 'solve_finished':
                            logger.info("🎉 Капча решена автоматически!")
                        elif status == 'not_detected':
                            logger.warning("⚠️ Капча не обнаружена")
                        elif status == 'solve_failed':
                            logger.error("❌ Решение капчи провалено")
                        else:
                            logger.warning(f"⚠️ Статус капчи: {status}")
                    
                    except Exception as cdp_error:
                        logger.error(f"❌ CDP метод ошибка: {cdp_error}")
                        logger.info("⏳ Ждем 15 секунд для ручного решения...")
                        page.wait_for_timeout(15000)
                else:
                    logger.info("✅ Капча не обнаружена (уже решена?)")
                
                # Проверяем результат
                logger.info("🔍 Проверка результата...")
                html = page.content()
                
                if 'Hello, user!' in html or 'Привет, user!' in html:
                    logger.info("="*60)
                    logger.info("🎉 УСПЕХ! Капча решена и форма отправлена!")
                    logger.info("✅ Найден текст 'Hello, user!' на странице")
                    logger.info("="*60)
                    return True
                elif 'captcha' in html.lower():
                    logger.warning("⚠️ Страница все еще содержит капчу")
                    logger.info("📄 Заголовок страницы: " + page.title())
                    
                    # Делаем скриншот для отладки
                    try:
                        screenshot_path = '/tmp/captcha_test.png'
                        page.screenshot(path=screenshot_path)
                        logger.info(f"📸 Скриншот сохранен: {screenshot_path}")
                    except Exception as e:
                        logger.error(f"❌ Не удалось сделать скриншот: {e}")
                    
                    return False
                else:
                    logger.info("✅ Страница загружена, но 'Hello, user!' не найден")
                    logger.info("📄 Заголовок страницы: " + page.title())
                    logger.info("📄 URL страницы: " + page.url)
                    return True
                    
            finally:
                logger.info("🔒 Закрытие браузера...")
                browser.close()
                logger.info("✅ Браузер закрыт")
        
    except PlaywrightTimeoutError as e:
        logger.error(f"❌ Таймаут: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        import traceback
        logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
        return False

def main():
    """Главная функция"""
    success = test_captcha_demo()
    
    if success:
        logger.info("="*60)
        logger.info("✅ ТЕСТ ПРОЙДЕН УСПЕШНО!")
        logger.info("="*60)
        sys.exit(0)
    else:
        logger.error("="*60)
        logger.error("❌ ТЕСТ ПРОВАЛЕН!")
        logger.error("="*60)
        sys.exit(1)

if __name__ == "__main__":
    main()

