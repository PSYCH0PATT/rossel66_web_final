#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовая версия Bandlink Parser для Mac
Тестируем с артистом "Sour Diesel"
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import List, Dict, Optional
import requests
from bs4 import BeautifulSoup
import urllib3

# Отключаем предупреждения о непроверенных SSL сертификатах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class BrightDataUnlockerAPI:
    """Класс для работы с Bright Data Web Unlocker через PROXY"""
    
    def __init__(self, username: str, password: str, zone: str = "web_unlocker1"):
        """
        Инициализация Web Unlocker API
        
        Args:
            username: Proxy username (формат: brd-customer-{customer_id}-zone-{zone_name})
            password: Proxy password
            zone: Зона (по умолчанию web_unlocker1)
        """
        self.zone = zone
        self.proxy_host = "brd.superproxy.io"
        self.proxy_port = 33335
        
        # Учетные данные для proxy
        self.proxy_username = username
        self.proxy_password = password
        
        self.request_count = 0
        self.max_requests = 10  # Ограничиваем для теста
        
        logger.info("🔧 Инициализация Bright Data Web Unlocker (PROXY режим)...")
        logger.info(f"🌐 Proxy: {self.proxy_host}:{self.proxy_port}")
        logger.info(f"👤 Username: {self.proxy_username[:50]}...")
        logger.info(f"🔐 Password: {'*' * len(self.proxy_password)}")
    
    def unlock_url(self, url: str, country: str = "us") -> Dict:
        """
        Получает HTML страницы через Web Unlocker PROXY
        Автоматически решает капчи (включая Yandex SmartCaptcha)
        
        Args:
            url: URL для разблокировки
            country: Код страны для геотаргетинга (по умолчанию "us")
        
        Returns:
            dict: {'success': bool, 'html': str, 'error': str}
        """
        if self.request_count >= self.max_requests:
            logger.error(f"🛡️ Достигнут лимит запросов: {self.max_requests}")
            return {
                'success': False,
                'error': f'Превышен лимит запросов ({self.max_requests})'
            }
        
        self.request_count += 1
        
        try:
            # Используем username как есть (без добавления country)
            # Country передается через параметр в URL или заголовки
            proxy_username_with_country = self.proxy_username
            
            # Настраиваем proxy для requests
            proxies = {
                'http': f'http://{proxy_username_with_country}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}',
                'https': f'http://{proxy_username_with_country}:{self.proxy_password}@{self.proxy_host}:{self.proxy_port}'
            }
            
            logger.info(f"📤 Запрос #{self.request_count} через Web Unlocker PROXY")
            logger.info(f"   URL: {url}")
            logger.info(f"   Proxy: {self.proxy_host}:{self.proxy_port}")
            logger.info(f"   Country: {country}")
            logger.info(f"   Username with country: {proxy_username_with_country[:60]}...")
            
            # Отправляем обычный GET запрос через proxy
            # Proxy автоматически обходит капчу и блокировки
            response = requests.get(
                url,
                proxies=proxies,
                verify=False,  # Отключаем проверку SSL сертификата (-k в curl)
                timeout=120,   # 2 минуты на решение капчи
                headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            
            logger.info(f"📊 Статус ответа: {response.status_code}")
            logger.info(f"📊 Размер ответа: {len(response.text)} символов")
            
            # Показываем ВСЕ заголовки ответа для анализа
            logger.info("="*60)
            logger.info("🔍 ПОЛНЫЕ ЗАГОЛОВКИ ОТВЕТА:")
            logger.info("="*60)
            for header, value in response.headers.items():
                logger.info(f"  {header}: {value}")
            logger.info("="*60)
            
            # Ищем специальные заголовки Bright Data
            logger.info("🔍 СПЕЦИАЛЬНЫЕ ЗАГОЛОВКИ BRIGHT DATA:")
            bright_data_headers = {
                'x-brd-debug': '🔧 DEBUG информация Web Unlocker (ВАЖНО!)',
                'x-luminati-ip': 'IP, выделенный для запроса',
                'x-luminati-ip-destination': 'IP целевого хоста',
                'x-luminati-timeline': 'Время выполнения запроса',
                'x-brightdata-ip': 'IP Bright Data',
                'x-brightdata-timeline': 'Timeline Bright Data',
            }
            
            found_bd_headers = False
            for header_name, description in bright_data_headers.items():
                if header_name in response.headers:
                    logger.info(f"  ✅ {header_name}: {response.headers[header_name]} ({description})")
                    found_bd_headers = True
            
            if not found_bd_headers:
                logger.warning("  ⚠️ Специальные заголовки Bright Data не найдены")
                logger.warning("  💡 Возможно, нужно включить 'Request details' в настройках зоны")
            logger.info("="*60)
            
            if response.status_code == 200:
                html = response.text
                logger.info(f"✅ Успешно! Получено HTML: {len(html)} символов")
                
                return {
                    'success': True,
                    'html': html
                }
            else:
                error_text = response.text[:500]  # Первые 500 символов
                logger.error(f"❌ Ошибка {response.status_code}: {error_text}")
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {error_text}'
                }
        
        except requests.exceptions.Timeout:
            logger.error("❌ Таймаут запроса (120 секунд)")
            return {'success': False, 'error': 'Timeout'}
        
        except requests.exceptions.ProxyError as e:
            logger.error(f"❌ Ошибка подключения к proxy: {e}")
            logger.error("Проверьте правильность username и password для Bright Data")
            return {'success': False, 'error': f'Proxy error: {str(e)}'}
        
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Ошибка HTTP: {e}")
            return {'success': False, 'error': str(e)}
        
        except Exception as e:
            logger.error(f"❌ Неизвестная ошибка: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {'success': False, 'error': str(e)}


def test_sour_diesel():
    """Тестируем парсинг артиста Sour Diesel"""
    
    logger.info("="*80)
    logger.info("🧪 ТЕСТ BANDLINK PARSER - SOUR DIESEL")
    logger.info("="*80)
    logger.info(f"⏰ Время начала: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Инициализируем Web Unlocker API с debug-логами и рендерингом JS
    u = os.environ.get("BRIGHT_DATA_WEB_UNLOCKER_USERNAME") or os.environ.get(
        "BRIGHT_DATA_RESIDENTIAL_USERNAME", ""
    )
    p = os.environ.get("BRIGHT_DATA_WEB_UNLOCKER_PASSWORD") or os.environ.get(
        "BRIGHT_DATA_RESIDENTIAL_PASSWORD", ""
    )
    if not u or not p:
        raise SystemExit("Задайте BRIGHT_DATA_WEB_UNLOCKER_* или BRIGHT_DATA_RESIDENTIAL_* в окружении")
    unlocker = BrightDataUnlockerAPI(username=u, password=p)
    
    # Тестируем артиста Sour Diesel
    artist_name = "Sour Diesel"
    
    try:
        logger.info("="*60)
        logger.info(f"🔍 Тестируем артиста: {artist_name}")
        logger.info("="*60)
        
        # Формируем URL для поиска (заменяем пробелы на +)
        search_query = artist_name.replace(' ', '+')
        search_url = f"https://band.link/scanner?search={search_query}"
        
        logger.info(f"🌐 URL поиска: {search_url}")
        logger.info(f"📝 Логика: band.link/scanner?search={search_query}")
        logger.info(f"🔄 Замена пробелов: '{artist_name}' → '{search_query}'")
        
        # Получаем HTML через Web Unlocker PROXY
        logger.info("🚀 Отправляем запрос через Web Unlocker...")
        result = unlocker.unlock_url(search_url, country="us")
        
        if not result['success']:
            logger.error(f"❌ Не удалось получить страницу: {result.get('error')}")
            logger.error("💡 Возможные причины:")
            logger.error("  - Проблемы с Web Unlocker proxy")
            logger.error("  - Неправильные credentials")
            logger.error("  - Проблемы с сетью")
            return False
        
        html = result['html']
        logger.info(f"✅ Страница получена: {len(html)} символов")
        
        # Анализируем содержимое HTML
        logger.info("🔍 Анализ полученного HTML:")
        logger.info(f"  - Размер HTML: {len(html)} символов")
        logger.info(f"  - Содержит 'playlist': {'playlist' in html.lower()}")
        logger.info(f"  - Содержит 'track': {'track' in html.lower()}")
        logger.info(f"  - Содержит 'artist': {'artist' in html.lower()}")
        logger.info(f"  - Содержит 'captcha': {'captcha' in html.lower()}")
        logger.info(f"  - Содержит 'sour diesel': {'sour diesel' in html.lower()}")
        
        # Проверяем, нет ли капчи в HTML
        captcha_detected = 'captcha' in html.lower() or 'showcaptcha' in html.lower()
        if captcha_detected:
            logger.warning("⚠️ В HTML все еще присутствует капча!")
            logger.warning("Это может означать, что Web Unlocker API не смог решить капчу")
            logger.warning("Проверьте логи Bright Data на наличие ошибок")
            logger.warning("Но продолжаем анализ HTML...")
        else:
            logger.info("✅ Капча не обнаружена в HTML")
        
        # Проверяем, есть ли данные о плейлистах
        if 'playlist' in html.lower() or 'track' in html.lower():
            logger.info("✅ HTML содержит данные о плейлистах/треках")
        else:
            logger.warning("⚠️ HTML не содержит данных о плейлистах/треках")
            logger.warning("Возможно, артист не найден или нет плейлистов")
        
        # Сохраняем HTML для анализа
        html_filename = f"parsers/sour_diesel_response_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(html_filename, 'w', encoding='utf-8') as f:
            f.write(html)
        logger.info(f"💾 HTML сохранен в файл: {html_filename}")
        
        # Анализируем HTML более детально
        logger.info("🔍 Детальный анализ HTML:")
        
        # Ищем ключевые элементы
        soup = BeautifulSoup(html, 'html.parser')
        
        # Проверяем заголовок страницы
        title = soup.find('title')
        if title:
            logger.info(f"  📄 Заголовок страницы: {title.get_text().strip()}")
        
        # Ищем элементы с плейлистами
        playlist_elements = soup.find_all(text=lambda text: text and 'playlist' in text.lower())
        logger.info(f"  🎵 Найдено упоминаний 'playlist': {len(playlist_elements)}")
        
        # Ищем элементы с треками
        track_elements = soup.find_all(text=lambda text: text and 'track' in text.lower())
        logger.info(f"  🎶 Найдено упоминаний 'track': {len(track_elements)}")
        
        # Ищем капчу
        captcha_elements = soup.find_all(text=lambda text: text and 'captcha' in text.lower())
        logger.info(f"  🤖 Найдено упоминаний 'captcha': {len(captcha_elements)}")
        
        # Ищем формы
        forms = soup.find_all('form')
        logger.info(f"  📝 Найдено форм: {len(forms)}")
        
        # Ищем iframe (часто используется для капчи)
        iframes = soup.find_all('iframe')
        logger.info(f"  🖼️ Найдено iframe: {len(iframes)}")
        
        # Показываем первые 500 символов HTML
        logger.info(f"📄 Начало HTML (первые 500 символов):")
        logger.info(f"   {html[:500]}...")
        
        # Показываем последние 500 символов HTML
        logger.info(f"📄 Конец HTML (последние 500 символов):")
        logger.info(f"   ...{html[-500:]}")
        
        # Кодируем HTML в base64 для передачи через API
        import base64
        html_b64 = base64.b64encode(html.encode('utf-8')).decode('utf-8')
        logger.info(f"HTML_BASE64_START:{html_b64}:HTML_BASE64_END")
        
        logger.info("="*60)
        logger.info("✅ ТЕСТ ЗАВЕРШЕН УСПЕШНО!")
        logger.info("="*60)
        logger.info(f"📊 Статистика:")
        logger.info(f"  - Артист: {artist_name}")
        logger.info(f"  - URL: {search_url}")
        logger.info(f"  - Размер HTML: {len(html)} символов")
        logger.info(f"  - Запросов к API: {unlocker.request_count}")
        logger.info(f"⏰ Время окончания: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка тестирования: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def main():
    """Главная функция"""
    try:
        logger.info("🚀 Запуск тестового парсера BandLink для Mac")
        logger.info("🎯 Цель: Протестировать парсинг артиста 'Sour Diesel'")
        
        success = test_sour_diesel()
        
        if success:
            logger.info("✅ Тест завершен успешно!")
            sys.exit(0)
        else:
            logger.error("❌ Тест завершен с ошибками!")
            sys.exit(1)
    
    except KeyboardInterrupt:
        logger.warning("\n⚠️ Прервано пользователем")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
