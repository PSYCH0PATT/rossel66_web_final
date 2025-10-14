#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Прямой HTTP клиент для 2captcha API
Решает Yandex SmartCaptcha через прямые запросы к API
"""

import requests
import time
import logging

logger = logging.getLogger(__name__)

class DirectCaptchaSolver:
    """Решатель капч через прямые HTTP запросы к 2captcha API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://2captcha.com"
        
    def solve_yandex_smart(self, sitekey: str, pageurl: str, max_wait_time: int = 120) -> dict:
        """
        Решает Yandex SmartCaptcha через прямой HTTP запрос
        
        Args:
            sitekey: Ключ сайта (data-sitekey)
            pageurl: URL страницы с капчей
            max_wait_time: Максимальное время ожидания решения (секунды)
            
        Returns:
            dict: {'success': bool, 'token': str, 'error': str}
        """
        logger.info("="*60)
        logger.info("🔐 РЕШЕНИЕ YANDEX SMARTCAPTCHA ЧЕРЕЗ ПРЯМОЙ API")
        logger.info("="*60)
        logger.info(f"📍 PageURL: {pageurl}")
        logger.info(f"🔑 Sitekey: {sitekey[:20]}...")
        
        try:
            # Шаг 1: Отправляем капчу на решение
            logger.info("📤 Шаг 1: Отправляем капчу в 2captcha...")
            
            submit_url = f"{self.base_url}/in.php"
            submit_params = {
                'key': self.api_key,
                'method': 'yandex',  # Метод для Yandex SmartCaptcha (аналог yandexSmart из JS)
                'sitekey': sitekey,
                'pageurl': pageurl,
                'json': 1
            }
            
            logger.info("📋 Используем метод 'yandex' (аналог yandexSmart из JavaScript библиотеки)")
            
            logger.info(f"🌐 URL: {submit_url}")
            logger.info(f"📋 Параметры: method=yandex, sitekey={sitekey[:20]}...")
            
            response = requests.post(submit_url, data=submit_params, timeout=30)
            result = response.json()
            
            logger.info(f"📥 Ответ от 2captcha: {result}")
            
            if result.get('status') != 1:
                error_msg = result.get('request', 'Unknown error')
                logger.error(f"❌ Ошибка отправки капчи: {error_msg}")
                return {'success': False, 'token': None, 'error': error_msg}
            
            captcha_id = result.get('request')
            logger.info(f"✅ Капча отправлена! ID: {captcha_id}")
            
            # Шаг 2: Ждем решения
            logger.info(f"⏳ Шаг 2: Ожидаем решения (макс {max_wait_time} секунд)...")
            
            get_url = f"{self.base_url}/res.php"
            start_time = time.time()
            attempts = 0
            
            while time.time() - start_time < max_wait_time:
                attempts += 1
                time.sleep(5)  # Ждем 5 секунд между проверками
                
                elapsed = int(time.time() - start_time)
                logger.info(f"🔄 Попытка {attempts} (прошло {elapsed}с/{max_wait_time}с)...")
                
                get_params = {
                    'key': self.api_key,
                    'action': 'get',
                    'id': captcha_id,
                    'json': 1
                }
                
                response = requests.get(get_url, params=get_params, timeout=30)
                result = response.json()
                
                if result.get('status') == 1:
                    token = result.get('request')
                    elapsed_total = int(time.time() - start_time)
                    logger.info("="*60)
                    logger.info(f"✅ КАПЧА РЕШЕНА!")
                    logger.info(f"⏱️ Время решения: {elapsed_total} секунд")
                    logger.info(f"🔑 Токен (первые 50 символов): {token[:50]}...")
                    logger.info("="*60)
                    return {'success': True, 'token': token, 'error': None}
                
                elif result.get('request') == 'CAPCHA_NOT_READY':
                    logger.info("⏳ Капча еще не готова, ждем...")
                    continue
                else:
                    error_msg = result.get('request', 'Unknown error')
                    logger.error(f"❌ Ошибка получения решения: {error_msg}")
                    return {'success': False, 'token': None, 'error': error_msg}
            
            logger.error(f"❌ Превышено время ожидания ({max_wait_time}с)")
            return {'success': False, 'token': None, 'error': 'Timeout'}
            
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка HTTP запроса: {e}")
            return {'success': False, 'token': None, 'error': str(e)}
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка: {e}")
            import traceback
            logger.error(f"🔍 Трассировка:\n{traceback.format_exc()}")
            return {'success': False, 'token': None, 'error': str(e)}

