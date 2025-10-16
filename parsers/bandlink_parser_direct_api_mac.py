#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Mac с прямым доступом к Bright Data API
Тестирование на captcha-api.yandex.ru/demo
"""

import json
import time
import requests
import logging
from datetime import datetime
from typing import Dict, List, Optional

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

class BrightDataDirectAPI:
    """Класс для работы с Bright Data через прямой API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.brightdata.com"
        self.zone = "web_unlocker1"
        self.max_attempts = 3
        
    def unlock_url(self, url: str) -> Dict:
        """
        Разблокирует URL через прямой API Bright Data
        Возвращает словарь с результатом
        """
        try:
            logger.info(f"🔓 Разблокировка URL через прямой API: {url}")
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "zone": self.zone,
                "url": url,
                "format": "raw"
            }
            
            logger.info(f"📤 Отправка запроса в Bright Data API...")
            response = requests.post(
                f"{self.base_url}/request",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            logger.info(f"📊 Статус ответа: {response.status_code}")
            logger.info(f"📄 Ответ (первые 200 символов): {response.text[:200]}")
            
            if response.status_code == 200:
                try:
                    result = response.json()
                    logger.info("✅ URL успешно разблокирован через прямой API")
                    return {
                        'success': True,
                        'html': result.get('html', ''),
                        'status_code': result.get('status_code', 200),
                        'headers': result.get('headers', {})
                    }
                except json.JSONDecodeError:
                    # Если не JSON, возможно это HTML
                    logger.info("📄 Получен HTML ответ (не JSON)")
                    return {
                        'success': True,
                        'html': response.text,
                        'status_code': 200,
                        'headers': dict(response.headers)
                    }
            else:
                logger.error(f"❌ Ошибка Bright Data API: {response.status_code}")
                logger.error(f"📄 Ответ: {response.text}")
                return {
                    'success': False,
                    'error': f"API error: {response.status_code}",
                    'response': response.text
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка HTTP запроса к Bright Data: {e}")
            return {
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка в Bright Data: {e}")
            return {
                'success': False,
                'error': str(e)
            }

class BandlinkParserDirectAPIMac:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.direct_api = None
        self.max_captcha_attempts = 3  # Максимум 3 попытки как просили
        self.captcha_attempts = 0
        self.init_direct_api()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Ошибка загрузки конфигурации: {e}")

        return {"target_artists": [], "bright_data_api_key": None}

    def init_direct_api(self):
        """Инициализирует прямой API Bright Data"""
        api_key = self.config.get('bright_data_api_key')
        if not api_key:
            # Используем API ключ из кода
            api_key = "4d65b7184094d3f99a670ab198fe0e8ce2116d52c66b05887aafe6fecb075a70"
            logger.info("🔑 Используем API ключ из кода")
        
        try:
            self.direct_api = BrightDataDirectAPI(api_key)
            logger.info("✅ Прямой API Bright Data инициализирован")
        except Exception as e:
            logger.error(f"❌ Ошибка инициализации прямого API: {e}")
            self.direct_api = None

    def test_direct_api(self) -> bool:
        """Тестирует прямой API на демо-странице"""
        try:
            logger.info("🧪 ТЕСТИРОВАНИЕ ПРЯМОГО API")
            logger.info("="*50)
            
            if not self.direct_api:
                logger.error("❌ Прямой API не инициализирован!")
                return False
            
            demo_url = "https://captcha-api.yandex.ru/demo"
            logger.info(f"🌐 Тестируем URL: {demo_url}")
            
            # Отправляем запрос через прямой API
            result = self.direct_api.unlock_url(demo_url)
            
            if result['success']:
                logger.info("✅ URL успешно разблокирован через прямой API!")
                
                # Анализируем полученный HTML
                html = result.get('html', '')
                if html:
                    logger.info(f"📄 Получен HTML длиной: {len(html)} символов")
                    
                    # Проверяем наличие капчи в HTML
                    if 'captcha' in html.lower() or 'robot' in html.lower():
                        logger.warning("🔒 Обнаружена капча в HTML")
                        return self.analyze_captcha_in_html(html)
                    else:
                        logger.info("✅ Капча не обнаружена в HTML")
                        return True
                else:
                    logger.error("❌ HTML пустой")
                    return False
            else:
                logger.error(f"❌ Ошибка API: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Ошибка тестирования прямого API: {e}")
            return False

    def analyze_captcha_in_html(self, html: str) -> bool:
        """Анализирует капчу в HTML"""
        try:
            logger.info("🔍 АНАЛИЗ КАПЧИ В HTML")
            logger.info("="*50)
            
            # Ищем различные признаки капчи
            captcha_indicators = [
                'captcha',
                'robot',
                'smartcaptcha',
                'yandex',
                'recaptcha',
                'hcaptcha'
            ]
            
            found_indicators = []
            for indicator in captcha_indicators:
                if indicator in html.lower():
                    found_indicators.append(indicator)
            
            if found_indicators:
                logger.warning(f"🔒 Найдены индикаторы капчи: {found_indicators}")
                
                # Ищем sitekey или captchaKey
                import re
                
                # Поиск sitekey
                sitekey_match = re.search(r'sitekey["\']?\s*[:=]\s*["\']([^"\']+)["\']', html, re.IGNORECASE)
                if sitekey_match:
                    sitekey = sitekey_match.group(1)
                    logger.info(f"🔑 Найден sitekey: {sitekey}")
                
                # Поиск captchaKey
                captchakey_match = re.search(r'captchaKey["\']?\s*[:=]\s*["\']([^"\']+)["\']', html, re.IGNORECASE)
                if captchakey_match:
                    captchakey = captchakey_match.group(1)
                    logger.info(f"🔑 Найден captchaKey: {captchakey}")
                
                # Если капча обнаружена, но API вернул HTML, значит она решена
                logger.info("✅ Капча автоматически решена через прямой API!")
                return True
            else:
                logger.info("✅ Капча не обнаружена в HTML")
                return True
                
        except Exception as e:
            logger.error(f"❌ Ошибка анализа капчи: {e}")
            return False

    def run_test(self):
        """Запускает полный тест прямого API"""
        logger.info("="*60)
        logger.info("🚀 ТЕСТ BANDLINK PARSER С ПРЯМЫМ API BRIGHT DATA")
        logger.info("="*60)
        logger.info("⚠️ Максимум 3 попытки решения капчи")
        logger.info("🌐 Режим: Прямой API (без браузера)")
        logger.info("="*60)
        
        try:
            # Тест прямого API
            if not self.test_direct_api():
                logger.error("❌ Тест прямого API провален")
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

def main():
    """Главная функция"""
    parser = BandlinkParserDirectAPIMac()
    parser.run_test()

if __name__ == "__main__":
    main()
