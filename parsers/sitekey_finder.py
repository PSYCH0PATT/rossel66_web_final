#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
КОМПЛЕКСНЫЙ ТЕСТ для поиска sitekey всеми возможными способами
"""

import time
import json
import re
import logging
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

class SitekeyFinder:
    def __init__(self, url):
        self.url = url
        self.driver = None
        self.results = {}
        
    def setup_driver(self):
        """Настройка Chrome драйвера"""
        try:
            logger.info("🔧 Настройка Chrome драйвера...")
            options = Options()
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--window-size=1920,1080')
            
            self.driver = webdriver.Chrome(options=options)
            logger.info("✅ Chrome драйвер настроен")
            return True
        except Exception as e:
            logger.error(f"❌ Ошибка настройки драйвера: {e}")
            return False
    
    def method_1_data_sitekey_attribute(self):
        """Способ 1: Поиск атрибута data-sitekey в элементах"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 1: Атрибут data-sitekey")
        logger.info("="*60)
        
        try:
            selectors = [
                '[data-sitekey]',
                '#captcha-container',
                '.smart-captcha',
                '.SmartCaptcha',
                'div[id*="captcha"]',
                'div[class*="captcha"]',
                'div[class*="Captcha"]'
            ]
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elements:
                        sitekey = elem.get_attribute('data-sitekey')
                        if sitekey:
                            logger.info(f"✅ Найден по селектору '{selector}': {sitekey}")
                            self.results['method_1'] = {'success': True, 'sitekey': sitekey, 'selector': selector}
                            return sitekey
                except:
                    continue
            
            logger.warning("❌ data-sitekey не найден в элементах")
            self.results['method_1'] = {'success': False, 'reason': 'No elements with data-sitekey'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_2_iframe_src(self):
        """Способ 2: Поиск sitekey в src атрибуте iframe"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 2: Sitekey в src iframe")
        logger.info("="*60)
        
        try:
            iframes = self.driver.find_elements(By.CSS_SELECTOR, 'iframe')
            logger.info(f"🔍 Найдено iframe: {len(iframes)}")
            
            for i, iframe in enumerate(iframes):
                src = iframe.get_attribute('src')
                logger.info(f"   iframe {i}: {src[:100] if src else 'no src'}...")
                
                if src and 'sitekey=' in src:
                    match = re.search(r'sitekey=([^&]+)', src)
                    if match:
                        sitekey = match.group(1)
                        logger.info(f"✅ Найден в iframe src: {sitekey}")
                        self.results['method_2'] = {'success': True, 'sitekey': sitekey, 'iframe_index': i}
                        return sitekey
            
            logger.warning("❌ sitekey не найден в iframe src")
            self.results['method_2'] = {'success': False, 'reason': 'No sitekey in iframe src'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_3_page_source_regex(self):
        """Способ 3: Поиск sitekey в HTML через regex"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 3: Regex поиск в HTML")
        logger.info("="*60)
        
        try:
            page_source = self.driver.page_source
            
            patterns = [
                r'data-sitekey="([^"]+)"',
                r'data-sitekey=\'([^\']+)\'',
                r'sitekey:\s*"([^"]+)"',
                r'sitekey:\s*\'([^\']+)\'',
                r'sitekey=([^&\s\'"]+)',
                r'"sitekey"\s*:\s*"([^"]+)"',
                r'\'sitekey\'\s*:\s*\'([^\']+)\'',
                r'captchaKey:\s*"([^"]+)"',
                r'captchaKey:\s*\'([^\']+)\''
            ]
            
            for pattern in patterns:
                match = re.search(pattern, page_source)
                if match:
                    sitekey = match.group(1)
                    if sitekey and sitekey != '':
                        logger.info(f"✅ Найден через regex '{pattern}': {sitekey}")
                        self.results['method_3'] = {'success': True, 'sitekey': sitekey, 'pattern': pattern}
                        return sitekey
            
            logger.warning("❌ sitekey не найден через regex")
            self.results['method_3'] = {'success': False, 'reason': 'No matches in regex patterns'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_4_javascript_variables(self):
        """Способ 4: Поиск в JavaScript переменных"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 4: JavaScript переменные")
        logger.info("="*60)
        
        try:
            scripts = [
                "return window.__SSR_DATA__?.sitekey || null;",
                "return window.__SSR_DATA__?.captchaKey || null;",
                "return window.smartCaptcha?.sitekey || null;",
                "return window.yandex?.smartCaptcha?.sitekey || null;",
                "return document.querySelector('#captcha-container')?.dataset?.sitekey || null;",
            ]
            
            for script in scripts:
                result = self.driver.execute_script(script)
                if result:
                    logger.info(f"✅ Найден через JS: {result}")
                    logger.info(f"   Скрипт: {script}")
                    self.results['method_4'] = {'success': True, 'sitekey': result, 'script': script}
                    return result
            
            # Проверяем полный window.__SSR_DATA__
            ssr_data = self.driver.execute_script("return window.__SSR_DATA__;")
            if ssr_data:
                logger.info(f"🔍 window.__SSR_DATA__ содержит:")
                logger.info(json.dumps(ssr_data, indent=2, ensure_ascii=False)[:500])
                
                # Ищем любые ключи похожие на sitekey
                for key, value in ssr_data.items():
                    if 'key' in key.lower() and isinstance(value, str) and len(value) > 10:
                        logger.info(f"💡 Возможный ключ: {key} = {value}")
            
            logger.warning("❌ sitekey не найден в JS переменных")
            self.results['method_4'] = {'success': False, 'reason': 'No JS variables with sitekey'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_5_meta_tags(self):
        """Способ 5: Поиск в meta тегах"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 5: Meta теги")
        logger.info("="*60)
        
        try:
            meta_tags = self.driver.find_elements(By.CSS_SELECTOR, 'meta')
            logger.info(f"🔍 Найдено meta тегов: {len(meta_tags)}")
            
            for meta in meta_tags:
                name = meta.get_attribute('name')
                content = meta.get_attribute('content')
                
                if name and 'sitekey' in name.lower():
                    logger.info(f"✅ Найден в meta name: {content}")
                    self.results['method_5'] = {'success': True, 'sitekey': content, 'meta_name': name}
                    return content
                
                if content and len(content) > 20 and 'key' in name.lower() if name else False:
                    logger.info(f"💡 Возможный meta: name={name}, content={content[:50]}...")
            
            logger.warning("❌ sitekey не найден в meta тегах")
            self.results['method_5'] = {'success': False, 'reason': 'No meta tags with sitekey'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_6_network_requests(self):
        """Способ 6: РУЧНОЙ - Проверка Network вкладки"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 6: Network запросы (РУЧНОЙ)")
        logger.info("="*60)
        logger.info("📋 ИНСТРУКЦИЯ ДЛЯ РУЧНОЙ ПРОВЕРКИ:")
        logger.info("1. Откройте DevTools (F12)")
        logger.info("2. Перейдите на вкладку Network")
        logger.info("3. Обновите страницу (Ctrl+R)")
        logger.info("4. Ищите запросы к:")
        logger.info("   - captcha-api.yandex.ru")
        logger.info("   - smartcaptcha")
        logger.info("   - yandex.ru/captcha")
        logger.info("5. Проверьте:")
        logger.info("   - URL запроса (может содержать sitekey=...)")
        logger.info("   - Headers (может быть X-Sitekey или подобное)")
        logger.info("   - Response (может содержать sitekey в JSON)")
        logger.info("⏳ Браузер остается открытым для проверки...")
        
        self.results['method_6'] = {'success': None, 'reason': 'Manual check required'}
        return None
    
    def method_7_local_storage(self):
        """Способ 7: LocalStorage и SessionStorage"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 7: LocalStorage и SessionStorage")
        logger.info("="*60)
        
        try:
            # LocalStorage
            local_storage = self.driver.execute_script("return Object.entries(localStorage);")
            logger.info(f"🔍 LocalStorage entries: {len(local_storage)}")
            
            for key, value in local_storage:
                if 'key' in key.lower():
                    logger.info(f"💡 LocalStorage: {key} = {value[:50] if len(value) > 50 else value}...")
                    if 'sitekey' in key.lower():
                        logger.info(f"✅ Найден в LocalStorage: {value}")
                        self.results['method_7'] = {'success': True, 'sitekey': value, 'storage': 'localStorage', 'key': key}
                        return value
            
            # SessionStorage
            session_storage = self.driver.execute_script("return Object.entries(sessionStorage);")
            logger.info(f"🔍 SessionStorage entries: {len(session_storage)}")
            
            for key, value in session_storage:
                if 'key' in key.lower():
                    logger.info(f"💡 SessionStorage: {key} = {value[:50] if len(value) > 50 else value}...")
                    if 'sitekey' in key.lower():
                        logger.info(f"✅ Найден в SessionStorage: {value}")
                        self.results['method_7'] = {'success': True, 'sitekey': value, 'storage': 'sessionStorage', 'key': key}
                        return value
            
            logger.warning("❌ sitekey не найден в Storage")
            self.results['method_7'] = {'success': False, 'reason': 'No sitekey in storage'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def method_8_cookies(self):
        """Способ 8: Cookies"""
        logger.info("\n" + "="*60)
        logger.info("СПОСОБ 8: Cookies")
        logger.info("="*60)
        
        try:
            cookies = self.driver.get_cookies()
            logger.info(f"🔍 Найдено cookies: {len(cookies)}")
            
            for cookie in cookies:
                name = cookie.get('name', '')
                value = cookie.get('value', '')
                
                if 'key' in name.lower():
                    logger.info(f"💡 Cookie: {name} = {value[:50] if len(value) > 50 else value}...")
                    if 'sitekey' in name.lower():
                        logger.info(f"✅ Найден в Cookie: {value}")
                        self.results['method_8'] = {'success': True, 'sitekey': value, 'cookie_name': name}
                        return value
            
            logger.warning("❌ sitekey не найден в Cookies")
            self.results['method_8'] = {'success': False, 'reason': 'No sitekey in cookies'}
            return None
            
        except Exception as e:
            logger.error(f"❌ Ошибка: {e}")
            return None
    
    def run_all_methods(self):
        """Запускает все методы поиска"""
        logger.info("="*60)
        logger.info("🚀 КОМПЛЕКСНЫЙ ПОИСК SITEKEY")
        logger.info(f"📍 URL: {self.url}")
        logger.info("="*60)
        
        if not self.setup_driver():
            return
        
        try:
            logger.info(f"🌐 Загрузка страницы: {self.url}")
            self.driver.get(self.url)
            time.sleep(3)
            
            logger.info(f"📄 Заголовок: {self.driver.title}")
            logger.info(f"📍 URL после загрузки: {self.driver.current_url}")
            
            # Запускаем все методы
            methods = [
                self.method_1_data_sitekey_attribute,
                self.method_2_iframe_src,
                self.method_3_page_source_regex,
                self.method_4_javascript_variables,
                self.method_5_meta_tags,
                self.method_7_local_storage,
                self.method_8_cookies,
                self.method_6_network_requests,  # Последний - ручной
            ]
            
            found_sitekey = None
            for method in methods:
                result = method()
                if result:
                    found_sitekey = result
                    logger.info(f"\n🎉 SITEKEY НАЙДЕН: {found_sitekey}")
                    break
            
            # Итоговый отчет
            logger.info("\n" + "="*60)
            logger.info("📊 ИТОГОВЫЙ ОТЧЕТ")
            logger.info("="*60)
            
            for method_name, result in self.results.items():
                status = "✅" if result.get('success') else "❌"
                logger.info(f"{status} {method_name}: {result}")
            
            if found_sitekey:
                logger.info("\n" + "="*60)
                logger.info(f"✅ УСПЕХ! Sitekey найден: {found_sitekey}")
                logger.info("="*60)
            else:
                logger.info("\n" + "="*60)
                logger.error("❌ SITEKEY НЕ НАЙДЕН АВТОМАТИЧЕСКИ")
                logger.info("💡 Попробуйте ручные методы (Network, Console)")
                logger.info("="*60)
            
            # Ждем для ручной проверки
            logger.info("\n⏳ Браузер остается открытым для ручной проверки...")
            logger.info("💡 Нажмите Ctrl+C для завершения")
            
            try:
                while True:
                    time.sleep(10)
            except KeyboardInterrupt:
                logger.info("\n⏹️ Завершено пользователем")
            
        finally:
            if self.driver:
                self.driver.quit()
                logger.info("🔒 Браузер закрыт")

def main():
    """Главная функция"""
    import sys
    
    if len(sys.argv) < 2:
        logger.error("❌ Не указан URL!")
        logger.info("💡 Использование: python3 sitekey_finder.py <URL>")
        logger.info("💡 Пример: python3 sitekey_finder.py 'https://band.link/showcaptcha?...'")
        return
    
    url = sys.argv[1]
    finder = SitekeyFinder(url)
    finder.run_all_methods()

if __name__ == "__main__":
    main()


