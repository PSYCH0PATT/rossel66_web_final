#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ОТДЕЛЬНЫЙ ТЕСТОВЫЙ СКРИПТ для провоцирования капчи на band.link
НЕ СВЯЗАН с основным проектом - только для тестирования!
"""

import time
import random
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import NoSuchElementException

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

class CaptchaTriggerTest:
    def __init__(self):
        self.driver = None
        self.actions_count = 0
        self.max_actions = 1000  # Максимум действий
        
    def setup_driver(self):
        """Настраивает Chrome драйвер для Mac"""
        try:
            logger.info("🔧 Настройка Chrome драйвера для Mac...")
            
            options = Options()
            # НЕ headless - показываем браузер
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            logger.info("✅ Chrome драйвер настроен")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка настройки драйвера: {e}")
            return False
    
    def detect_captcha(self):
        """Определяет наличие капчи"""
        try:
            current_url = self.driver.current_url
            page_title = self.driver.title.lower()
            
            # Проверка URL
            if 'showcaptcha' in current_url.lower() or 'captcha' in current_url.lower():
                logger.warning("🔒 КАПЧА ОБНАРУЖЕНА В URL!")
                logger.info(f"📍 URL: {current_url}")
                return True
            
            # Проверка заголовка
            if 'robot' in page_title or 'captcha' in page_title:
                logger.warning("🔒 КАПЧА ОБНАРУЖЕНА В ЗАГОЛОВКЕ!")
                logger.info(f"📄 Заголовок: {page_title}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"⚠️ Ошибка детекта капчи: {e}")
            return False
    
    def find_sitekey(self):
        """Ищет sitekey на странице капчи"""
        try:
            logger.info("🔍 ПОИСК SITEKEY НА СТРАНИЦЕ КАПЧИ...")
            
            # Способ 1: JavaScript поиск
            sitekey = self.driver.execute_script("""
                // Ищем все возможные варианты
                var selectors = [
                    '[data-sitekey]',
                    '#captcha-container',
                    '.smart-captcha',
                    '.SmartCaptcha',
                    'div[id*="captcha"]',
                    'div[class*="captcha"]'
                ];
                
                for (var i = 0; i < selectors.length; i++) {
                    var elem = document.querySelector(selectors[i]);
                    if (elem) {
                        var key = elem.getAttribute('data-sitekey');
                        if (key) {
                            console.log('Found sitekey in element:', selectors[i]);
                            return key;
                        }
                    }
                }
                
                // Ищем в iframe
                var iframes = document.querySelectorAll('iframe');
                for (var i = 0; i < iframes.length; i++) {
                    var src = iframes[i].src;
                    if (src && src.includes('sitekey=')) {
                        var match = src.match(/sitekey=([^&]+)/);
                        if (match) {
                            console.log('Found sitekey in iframe:', src);
                            return match[1];
                        }
                    }
                }
                
                return null;
            """)
            
            if sitekey:
                logger.info(f"✅ SITEKEY НАЙДЕН: {sitekey}")
                return sitekey
            
            # Способ 2: Поиск в HTML
            logger.info("🔍 Поиск sitekey в HTML коде...")
            page_source = self.driver.page_source
            
            import re
            patterns = [
                r'data-sitekey="([^"]+)"',
                r'sitekey:\s*"([^"]+)"',
                r'sitekey=([^&\s]+)',
                r'"sitekey"\s*:\s*"([^"]+)"'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, page_source)
                if match:
                    sitekey = match.group(1)
                    logger.info(f"✅ SITEKEY НАЙДЕН ЧЕРЕЗ REGEX: {sitekey}")
                    return sitekey
            
            # Способ 3: Подробная отладка
            logger.error("❌ SITEKEY НЕ НАЙДЕН!")
            logger.info("🔍 HTML страницы (первые 2000 символов):")
            logger.info(page_source[:2000])
            
            logger.info("🔍 Все iframe элементы:")
            iframes = self.driver.find_elements(By.CSS_SELECTOR, 'iframe')
            for i, iframe in enumerate(iframes):
                src = iframe.get_attribute('src')
                logger.info(f"   iframe {i}: {src[:200] if src else 'no src'}...")
            
            logger.info("🔍 Все элементы с data-sitekey:")
            elements_with_sitekey = self.driver.find_elements(By.CSS_SELECTOR, '[data-sitekey]')
            for i, elem in enumerate(elements_with_sitekey):
                sitekey_attr = elem.get_attribute('data-sitekey')
                logger.info(f"   element {i}: {sitekey_attr}")
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка поиска sitekey: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return None
    
    def analyze_captcha_page(self):
        """Анализирует страницу капчи и ищет sitekey"""
        logger.info("="*60)
        logger.info("🔍 АНАЛИЗ СТРАНИЦЫ КАПЧИ")
        logger.info("="*60)
        
        # Ищем sitekey
        sitekey = self.find_sitekey()
        
        if sitekey:
            logger.info("="*60)
            logger.info("✅ УСПЕХ! SITEKEY НАЙДЕН!")
            logger.info(f"🔑 Sitekey: {sitekey}")
            logger.info("="*60)
            logger.info("💡 Теперь можно настроить парсер для поиска этого sitekey")
        else:
            logger.error("="*60)
            logger.error("❌ SITEKEY НЕ НАЙДЕН!")
            logger.error("💡 Нужно улучшить поиск sitekey")
            logger.error("="*60)
        
        # Ждем для анализа (браузер остается открытым)
        logger.info("⏳ Браузер остается открытым для анализа...")
        logger.info("💡 Вы можете вручную изучить страницу капчи")
        logger.info("💡 Нажмите Ctrl+C для завершения")
        
        try:
            # Ждем бесконечно, пока пользователь не прервет
            while True:
                time.sleep(10)
                logger.info("⏳ Браузер все еще открыт... (Ctrl+C для завершения)")
        except KeyboardInterrupt:
            logger.info("\n⏹️ Анализ завершен пользователем")
    
    def perform_aggressive_actions(self):
        """Выполняет агрессивные действия для провоцирования капчи"""
        try:
            logger.info(f"🎯 Действие #{self.actions_count + 1}: Агрессивные действия...")
            
            # 1. Быстрые переходы на scanner
            for i in range(5):
                self.driver.get('https://band.link/scanner')
                time.sleep(0.1)  # Очень быстро!
                logger.info(f"   Быстрый переход {i+1}/5")
                
                # Проверяем капчу после каждого перехода
                if self.detect_captcha():
                    logger.warning("🔒 КАПЧА ОБНАРУЖЕНА ПОСЛЕ ПЕРЕХОДА!")
                    return True
            
            # 2. Быстрый поиск
            try:
                search_selectors = [
                    'input[type="search"]', 
                    'input[placeholder*="search"]', 
                    'input[placeholder*="Search"]',
                    'input[placeholder*="поиск"]', 
                    'input[placeholder*="Поиск"]'
                ]
                
                search_input = None
                for selector in search_selectors:
                    try:
                        search_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                        break
                    except:
                        continue
                
                if search_input:
                    for i in range(10):
                        search_input.clear()
                        search_input.send_keys(f"test{i}")
                        time.sleep(0.05)  # Очень быстро!
                        search_input.send_keys(Keys.RETURN)
                        time.sleep(0.1)
                        
                        # Проверяем капчу после каждого поиска
                        if self.detect_captcha():
                            logger.warning("🔒 КАПЧА ОБНАРУЖЕНА ПОСЛЕ ПОИСКА!")
                            return True
                    
                    logger.info("   Быстрый поиск выполнен")
                else:
                    logger.warning("   Поле поиска не найдено")
            except:
                logger.warning("   Ошибка поиска")
            
            # 3. Быстрая прокрутка
            for i in range(20):
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(0.05)
                self.driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(0.05)
                
                # Проверяем капчу каждые 5 прокруток
                if i % 5 == 0 and self.detect_captcha():
                    logger.warning("🔒 КАПЧА ОБНАРУЖЕНА ПОСЛЕ ПРОКРУТКИ!")
                    return True
            
            logger.info("   Быстрая прокрутка выполнена")
            
            # 4. Быстрые клики
            try:
                elements = self.driver.find_elements(By.CSS_SELECTOR, 'a, button, div[class*="card"]')
                for i in range(min(10, len(elements))):
                    try:
                        elements[i].click()
                        time.sleep(0.1)
                        
                        # Проверяем капчу после каждого клика
                        if self.detect_captcha():
                            logger.warning("🔒 КАПЧА ОБНАРУЖЕНА ПОСЛЕ КЛИКА!")
                            return True
                    except:
                        pass
                logger.info("   Быстрые клики выполнены")
            except:
                logger.warning("   Элементы для клика не найдены")
            
            self.actions_count += 1
            logger.info(f"✅ Действие #{self.actions_count} завершено")
            return False  # Капча не обнаружена
            
        except Exception as e:
            logger.error(f"❌ Ошибка выполнения действий: {e}")
            return False
    
    def run_test(self):
        """Запускает тест провоцирования капчи"""
        logger.info("="*60)
        logger.info("🚀 ТЕСТ ПРОВОЦИРОВАНИЯ КАПЧИ НА BAND.LINK")
        logger.info("="*60)
        logger.info("⚠️ ВНИМАНИЕ: Этот скрипт будет выполнять агрессивные действия!")
        logger.info("⚠️ Цель: спровоцировать появление капчи для тестирования")
        logger.info("="*60)
        
        if not self.setup_driver():
            return
        
        try:
            # ТЕСТ: Сначала проверим ДЕМО-страницу Яндекса (как в GitHub проекте)
            logger.info("🧪 ТЕСТ: Проверка демо-страницы Яндекса (как в GitHub проекте)...")
            self.driver.get('https://captcha-api.yandex.ru/demo')
            time.sleep(3)
            
            logger.info("🔍 Поиск sitekey на ДЕМО-странице...")
            demo_sitekey = self.find_sitekey()
            
            if demo_sitekey:
                logger.info(f"✅ На ДЕМО-странице найден sitekey: {demo_sitekey}")
                logger.info("💡 Значит метод поиска работает правильно!")
            else:
                logger.warning("⚠️ На ДЕМО-странице sitekey НЕ найден!")
                logger.warning("💡 Это означает проблему в методе поиска")
            
            # Теперь проверяем band.link
            logger.info("\n🌐 Переход на band.link/scanner...")
            self.driver.get('https://band.link/scanner')
            time.sleep(2)
            
            # Выполняем агрессивные действия пока не появится капча
            while self.actions_count < self.max_actions:
                logger.info(f"\n{'='*50}")
                logger.info(f"ЦИКЛ #{self.actions_count + 1}")
                logger.info(f"{'='*50}")
                
                # Проверяем капчу в начале цикла
                if self.detect_captcha():
                    logger.warning("🎉 КАПЧА УЖЕ ПРИСУТСТВУЕТ!")
                    self.analyze_captcha_page()
                    break
                
                # Выполняем агрессивные действия
                captcha_detected = self.perform_aggressive_actions()
                
                # Если капча обнаружена во время действий
                if captcha_detected:
                    logger.warning("🎉 КАПЧА ПОЯВИЛАСЬ ВО ВРЕМЯ ДЕЙСТВИЙ!")
                    self.analyze_captcha_page()
                    break
                
                # Небольшая пауза между циклами
                time.sleep(1)
            
            if self.actions_count >= self.max_actions:
                logger.warning(f"⚠️ Достигнут лимит действий ({self.max_actions})")
                logger.warning("💡 Капча не появилась, возможно нужны другие действия")
            
        except KeyboardInterrupt:
            logger.info("\n⏹️ Тест прерван пользователем")
        except Exception as e:
            logger.error(f"❌ Критическая ошибка: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
        finally:
            if self.driver:
                logger.info("⏳ Браузер остается открытым для анализа...")
                logger.info("💡 Закройте браузер вручную когда закончите анализ")
                logger.info("💡 Или нажмите Ctrl+C для принудительного закрытия")
                
                try:
                    # Ждем, пока пользователь не закроет браузер или не прервет
                    while True:
                        time.sleep(5)
                        # Проверяем, жив ли драйвер
                        try:
                            self.driver.current_url
                        except:
                            logger.info("🔒 Браузер закрыт пользователем")
                            break
                except KeyboardInterrupt:
                    logger.info("\n⏹️ Принудительное закрытие браузера...")
                    self.driver.quit()
                    logger.info("🔒 Браузер закрыт")

def main():
    """Главная функция"""
    test = CaptchaTriggerTest()
    test.run_test()

if __name__ == "__main__":
    main()
