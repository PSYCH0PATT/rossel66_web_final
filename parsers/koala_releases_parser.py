#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Koala Music Releases Parser
Парсер релизов с агрегатора Koala Music для автоматического добавления в систему
"""

import json
import time
import random
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
import re

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium webdriver-manager")
    sys.exit(1)


class KoalaReleasesParser:
    """Парсер релизов с Koala Music"""
    
    # Статусы, которые нужно пропускать
    SKIP_STATUSES = ['Черновик']
    
    # Статусы с UPC кодом
    UPC_STATUSES = ['Доставлен']
    
    def __init__(self, config_file: str = None):
        self.config_file = config_file or os.path.join(os.path.dirname(__file__), 'koala_config.json')
        self.config = self.load_config()
        self.driver = None
        self.results: List[Dict] = []
        
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"❌ Ошибка загрузки конфигурации: {e}")
        
        # Дефолтная конфигурация
        return {
            "login": "",
            "password": "",
            "base_url": "https://portal.koala-music.com",
            "headless": True,
            "timeout": 30
        }
    
    def setup_driver(self) -> bool:
        """Настраивает WebDriver"""
        try:
            chrome_options = Options()
            
            # Headless режим (если включен)
            if self.config.get('headless', True):
                chrome_options.add_argument('--headless=new')
            
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--start-maximized')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Определяем ОС и настраиваем драйвер
            import platform
            is_linux = platform.system() == 'Linux'
            
            if is_linux:
                # На Linux/Alpine используем системный Chromium
                # Alpine: /usr/bin/chromium-browser
                # Debian/Ubuntu: /usr/bin/chromium или /usr/bin/google-chrome
                for chrome_path in ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome']:
                    if os.path.exists(chrome_path):
                        chrome_options.binary_location = chrome_path
                        print(f"🐧 Chrome binary: {chrome_path}")
                        break
                
                # Проверяем доступные пути к chromedriver
                chromedriver_paths = [
                    '/usr/bin/chromedriver',           # Alpine (chromium-chromedriver)
                    '/usr/bin/chromium-driver',        # Некоторые дистрибутивы
                    '/usr/lib/chromium/chromedriver',  # Debian
                    '/usr/local/bin/chromedriver'      # Manual install
                ]
                
                chromedriver_path = None
                for path in chromedriver_paths:
                    if os.path.exists(path):
                        chromedriver_path = path
                        break
                
                if chromedriver_path:
                    print(f"🐧 Linux: используем системный chromedriver: {chromedriver_path}")
                    service = Service(chromedriver_path)
                else:
                    print("⚠️  Системный chromedriver не найден, пробуем webdriver-manager...")
                    service = Service(ChromeDriverManager().install())
            else:
                # На Mac/Windows используем webdriver-manager
                service = Service(ChromeDriverManager().install())
            
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Убираем флаг webdriver
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Настройка таймаутов
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            print("✅ Chrome WebDriver запущен")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка запуска Chrome WebDriver: {e}")
            return False
    
    def login(self) -> bool:
        """Авторизация на портале Koala Music"""
        try:
            login_email = self.config.get('login', '')
            login_password = self.config.get('password', '')
            
            if not login_email or not login_password:
                print("❌ Логин или пароль не указаны в конфигурации")
                return False
            
            print("🔐 Начинаем авторизацию...")
            
            # Переходим на страницу релизов (она перенаправит на логин)
            releases_url = f"{self.config['base_url']}/releases"
            self.driver.get(releases_url)
            time.sleep(3)
            
            # Проверяем, нужна ли авторизация
            current_url = self.driver.current_url
            if 'identity.koala-music.com' not in current_url and '/Account/Login' not in current_url:
                print("✅ Уже авторизован")
                return True
            
            print("📝 Заполняем форму входа...")
            
            # Ждем появления формы
            wait = WebDriverWait(self.driver, self.config.get('timeout', 30))
            
            # Находим поле email
            email_field = wait.until(EC.presence_of_element_located(
                (By.CSS_SELECTOR, 'input[name="Username"], input[type="email"], input[placeholder*="mail"]')
            ))
            email_field.clear()
            email_field.send_keys(login_email)
            time.sleep(0.5)
            
            # Находим поле пароля
            password_field = self.driver.find_element(
                By.CSS_SELECTOR, 'input[name="Password"], input[type="password"]'
            )
            password_field.clear()
            password_field.send_keys(login_password)
            time.sleep(0.5)
            
            # Нажимаем кнопку входа
            try:
                submit_button = self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
            except NoSuchElementException:
                # Пробуем найти по тексту кнопки
                buttons = self.driver.find_elements(By.TAG_NAME, 'button')
                submit_button = None
                for btn in buttons:
                    text = btn.text.lower()
                    if 'продолжить' in text or 'войти' in text or 'вход' in text:
                        submit_button = btn
                        break
                if not submit_button and buttons:
                    submit_button = buttons[-1]  # Последняя кнопка как fallback
            
            if submit_button:
                submit_button.click()
            
            # Ждем редиректа на страницу релизов
            print("⏳ Ожидаем авторизацию...")
            time.sleep(5)
            
            # Проверяем успешность авторизации
            current_url = self.driver.current_url
            if 'releases' in current_url or self.config['base_url'] in current_url:
                print("✅ Авторизация успешна")
                return True
            else:
                print(f"❌ Авторизация не удалась. Текущий URL: {current_url}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка авторизации: {e}")
            return False
    
    def wait_for_page_load(self, timeout: int = 10):
        """Ждет загрузки страницы"""
        try:
            time.sleep(2)
            WebDriverWait(self.driver, timeout).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
        except:
            pass
    
    def get_releases_list(self) -> List[Dict]:
        """Получает список релизов со страницы"""
        releases = []
        
        try:
            print("\n📋 Получаем список релизов...")
            
            # Переходим на страницу релизов
            releases_url = f"{self.config['base_url']}/releases"
            self.driver.get(releases_url)
            self.wait_for_page_load()
            time.sleep(3)
            
            # Ищем все карточки релизов
            # Они представлены как ссылки в секции
            release_cards = self.driver.find_elements(
                By.CSS_SELECTOR, 'section a[href*="/releases/"]'
            )
            
            if not release_cards:
                # Альтернативный селектор
                release_cards = self.driver.find_elements(
                    By.XPATH, '//a[contains(@href, "/releases/") and not(contains(@href, "/releases/add"))]'
                )
            
            print(f"📦 Найдено карточек: {len(release_cards)}")
            
            for card in release_cards:
                try:
                    # Получаем href для извлечения koala_id
                    href = card.get_attribute('href')
                    if not href or '/releases/' not in href:
                        continue
                    
                    # Извлекаем ID из URL
                    koala_id_match = re.search(r'/releases/(\d+)', href)
                    if not koala_id_match:
                        continue
                    koala_id = koala_id_match.group(1)
                    
                    # Получаем текст карточки для извлечения данных
                    card_text = card.text
                    lines = [l.strip() for l in card_text.split('\n') if l.strip()]
                    
                    if len(lines) < 2:
                        continue
                    
                    # Парсим данные из текста карточки
                    # Формат: Название / Артисты / Статус / Тип • Дата
                    title = lines[0] if lines else 'Без названия'
                    artist = lines[1] if len(lines) > 1 else 'Неизвестный артист'
                    
                    # Ищем статус в тексте
                    status = None
                    for status_name in ['Черновик', 'На модерации', 'Одобрен', 'Отклонён', 'В доставке', 'Доставлен', 'Снят']:
                        if status_name in card_text:
                            status = status_name
                            break
                    
                    if not status:
                        status = 'Неизвестен'
                    
                    # Ищем дату (формат: ДД.ММ.ГГГГ)
                    date_match = re.search(r'(\d{2}\.\d{2}\.\d{4})', card_text)
                    release_date = date_match.group(1) if date_match else None
                    
                    # Пропускаем черновики
                    if status in self.SKIP_STATUSES:
                        print(f"  ⏭️  Пропускаем черновик: {title}")
                        continue
                    
                    release_info = {
                        'koala_id': koala_id,
                        'title': title,
                        'artist': artist,
                        'status': status,
                        'release_date': release_date,
                        'href': href
                    }
                    
                    releases.append(release_info)
                    print(f"  ✅ {title} ({artist}) - {status}")
                    
                except StaleElementReferenceException:
                    continue
                except Exception as e:
                    print(f"  ⚠️  Ошибка парсинга карточки: {e}")
                    continue
            
            print(f"\n📊 Всего релизов (без черновиков): {len(releases)}")
            return releases
            
        except Exception as e:
            print(f"❌ Ошибка получения списка релизов: {e}")
            return []
    
    def get_release_details(self, release_info: Dict) -> Dict:
        """Получает детальную информацию о релизе"""
        try:
            koala_id = release_info['koala_id']
            print(f"\n🔍 Получаем детали релиза {release_info['title']}...")
            
            # Переходим на страницу релиза
            release_url = f"{self.config['base_url']}/releases/{koala_id}"
            self.driver.get(release_url)
            self.wait_for_page_load()
            time.sleep(2)
            
            # Получаем весь текст страницы
            page_text = self.driver.find_element(By.TAG_NAME, 'body').text
            
            # Извлекаем UPC (только для доставленных релизов)
            upc = None
            if release_info.get('status') in self.UPC_STATUSES:
                upc_match = re.search(r'UPC\s*[\n:]*\s*(\d{12,14})', page_text)
                if upc_match:
                    upc = upc_match.group(1)
                    print(f"  📊 UPC: {upc}")
            
            # Извлекаем BandLink
            bandlink_url = None
            try:
                bandlink_elements = self.driver.find_elements(
                    By.XPATH, '//a[contains(@href, "band.link")]'
                )
                if bandlink_elements:
                    bandlink_url = bandlink_elements[0].get_attribute('href')
                    print(f"  🔗 BandLink: {bandlink_url}")
            except:
                pass
            
            # Извлекаем обложку
            cover_url = None
            try:
                img_elements = self.driver.find_elements(
                    By.CSS_SELECTOR, 'img[src*="cover"], img[src*="image"], aside img, main img'
                )
                for img in img_elements:
                    src = img.get_attribute('src')
                    if src and ('http' in src) and ('logo' not in src.lower()):
                        cover_url = src
                        print(f"  🖼️  Обложка найдена")
                        break
            except:
                pass
            
            # Извлекаем ISRC коды из трек-листа
            isrc_codes = []
            try:
                isrc_matches = re.findall(r'ISRC\s*[\n:]*\s*([A-Z]{2}[A-Z0-9]{3}\d{7})', page_text)
                if isrc_matches:
                    isrc_codes = list(set(isrc_matches))
                    print(f"  🎵 ISRC кодов найдено: {len(isrc_codes)}")
            except:
                pass
            
            # Обновляем информацию о релизе
            release_info.update({
                'upc': upc,
                'bandlink_url': bandlink_url,
                'cover_url': cover_url,
                'isrc_codes': isrc_codes,
                'parsed_at': datetime.now().isoformat()
            })
            
            return release_info
            
        except Exception as e:
            print(f"  ❌ Ошибка получения деталей: {e}")
            return release_info
    
    def parse_all(self) -> List[Dict]:
        """Основной метод парсинга всех релизов"""
        print("\n" + "="*60)
        print("🎵 KOALA MUSIC RELEASES PARSER")
        print("="*60)
        
        try:
            # Настраиваем драйвер
            if not self.setup_driver():
                return []
            
            # Авторизуемся
            if not self.login():
                return []
            
            # Получаем список релизов
            releases = self.get_releases_list()
            
            if not releases:
                print("⚠️  Релизы не найдены")
                return []
            
            # Получаем детали каждого релиза
            print("\n" + "-"*40)
            print("📥 Получаем детали релизов...")
            print("-"*40)
            
            for release in releases:
                release = self.get_release_details(release)
                self.results.append(release)
                
                # Небольшая задержка между запросами
                time.sleep(random.uniform(1, 2))
            
            print("\n" + "="*60)
            print(f"✅ ПАРСИНГ ЗАВЕРШЁН")
            print(f"📊 Всего релизов: {len(self.results)}")
            print("="*60)
            
            return self.results
            
        except Exception as e:
            print(f"❌ Критическая ошибка: {e}")
            return []
            
        finally:
            self.close()
    
    def save_results(self, output_file: str = None):
        """Сохраняет результаты в JSON файл"""
        if not output_file:
            output_file = os.path.join(os.path.dirname(__file__), 'koala_output.json')
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=2)
            print(f"💾 Результаты сохранены в {output_file}")
        except Exception as e:
            print(f"❌ Ошибка сохранения результатов: {e}")
    
    def close(self):
        """Закрывает браузер"""
        if self.driver:
            try:
                self.driver.quit()
                print("🔒 Браузер закрыт")
            except:
                pass


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Koala Music Releases Parser')
    parser.add_argument('--config', '-c', type=str, help='Путь к файлу конфигурации')
    parser.add_argument('--output', '-o', type=str, help='Путь для сохранения результатов')
    args = parser.parse_args()
    
    # Создаем парсер
    koala_parser = KoalaReleasesParser(config_file=args.config)
    
    # Запускаем парсинг
    results = koala_parser.parse_all()
    
    # Сохраняем результаты
    if results:
        koala_parser.save_results(args.output)
        
        # Выводим результаты в stdout для API
        print("\n📤 JSON_OUTPUT_START")
        print(json.dumps(results, ensure_ascii=False))
        print("JSON_OUTPUT_END")
    
    return len(results)


if __name__ == '__main__':
    sys.exit(0 if main() > 0 else 1)

