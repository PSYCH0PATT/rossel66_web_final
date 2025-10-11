#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bandlink Parser для Mac - версия для локального тестирования
"""

import json
import time
import random
import os
import sqlite3
import sys
from datetime import datetime
from typing import Dict, List, Optional

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

try:
    from twocaptcha import TwoCaptcha
    TWOCAPTCHA_AVAILABLE = True
except ImportError:
    print("⚠️ 2captcha-python не установлен. Капчи не будут решаться автоматически.")
    TWOCAPTCHA_AVAILABLE = False

class BandlinkParserMac:
    def __init__(self, config_file: str = None):
        self.config_file = config_file
        self.config = self.load_config()
        self.db_path = 'bandlink_playlists_mac.db'
        self.driver = None
        self.captcha_solver = None
        self.init_database()
        self.init_captcha_solver()
    
    def load_config(self) -> Dict:
        """Загружает конфигурацию из файла"""
        if self.config_file and os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Ошибка загрузки конфигурации: {e}")

        return {"target_artists": [], "captcha_api_key": None}

    def init_database(self):
        """Инициализирует базу данных"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    artist_name TEXT NOT NULL,
                    playlist_name TEXT NOT NULL,
                    playlist_artist TEXT,
                    track_names TEXT,
                    likes_count TEXT,
                    platform TEXT,
                    playlist_cover_url TEXT,
                    playlist_url TEXT,
                    parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(artist_name, playlist_name)
                )
            ''')
            
            # Проверяем существующие колонки и добавляем недостающие
            cursor.execute("PRAGMA table_info(playlists)")
            existing_columns = [column[1] for column in cursor.fetchall()]
            
            columns_to_add = {
                'playlist_artist': 'TEXT',
                'track_names': 'TEXT',
                'likes_count': 'TEXT',
                'platform': 'TEXT',
                'playlist_cover_url': 'TEXT',
                'playlist_url': 'TEXT'
            }
            
            for column_name, column_type in columns_to_add.items():
                if column_name not in existing_columns:
                    try:
                        cursor.execute(f'ALTER TABLE playlists ADD COLUMN {column_name} {column_type}')
                        print(f"  ✅ Добавлена колонка: {column_name}")
                    except Exception as e:
                        print(f"  ⚠️ Ошибка добавления колонки {column_name}: {e}")
            
            conn.commit()
            conn.close()
            print(f"✅ База данных инициализирована: {self.db_path}")
        except Exception as e:
            print(f"❌ Ошибка инициализации базы данных: {e}")

    def init_captcha_solver(self):
        """Инициализирует 2captcha solver если API ключ предоставлен"""
        api_key = self.config.get('captcha_api_key')

        if api_key and TWOCAPTCHA_AVAILABLE:
            try:
                self.captcha_solver = TwoCaptcha(api_key)
                print(f"✅ 2captcha инициализирован (API ключ: {api_key[:8]}...)")
            except Exception as e:
                print(f"❌ Ошибка инициализации 2captcha: {e}")
                self.captcha_solver = None
        elif api_key and not TWOCAPTCHA_AVAILABLE:
            print("⚠️ API ключ 2captcha предоставлен, но библиотека не установлена!")
        else:
            print("ℹ️  2captcha не настроен. Парсинг может не работать при появлении капчи.")

    def setup_clean_driver(self) -> bool:
        """Настраивает чистый Chrome драйвер для Mac"""
        try:
            print("🔧 Настройка Chrome драйвера для Mac...")
            
            options = Options()
            
            # Основные настройки для Mac
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)
            
            # Для локального тестирования - НЕ headless (чтобы видеть что происходит)
            # options.add_argument('--headless')  # Закомментировано для визуального тестирования
            
            # Настройки окна для удобства
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--start-maximized')
            
            # User agent
            options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            
            # Отключаем изображения для ускорения (опционально)
            # prefs = {"profile.managed_default_content_settings.images": 2}
            # options.add_experimental_option("prefs", prefs)
            
            print("🚀 Запуск Chrome браузера...")
            self.driver = webdriver.Chrome(options=options)
            
            # Убираем флаг webdriver
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            print("✅ Chrome драйвер успешно настроен")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка настройки Chrome драйвера: {e}")
            return False

    def human_like_behavior(self):
        """Имитирует человеческое поведение (упрощенная версия для Mac)"""
        try:
            # ТЕСТОВЫЙ РЕЖИМ: Минимальные задержки для вызова капчи
            time.sleep(0.1)  # Очень короткая задержка - палевно!
            
            # Быстрый скролл - тоже палевно
            self.driver.execute_script("window.scrollBy(0, 100);")
            time.sleep(0.1)
            
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(0.1)
            
        except Exception as e:
            print(f"⚠️ Ошибка имитации поведения: {e}")

    def navigate_to_scanner(self) -> bool:
        """Переходит на страницу сканера Bandlink"""
        try:
            print("🌐 Переход на band.link/scanner...")
            print("🤖 ТЕСТОВЫЙ РЕЖИМ: Быстрые действия для вызова капчи!")
            self.driver.get("https://band.link/scanner")
            
            # ТЕСТОВЫЙ РЕЖИМ: Минимальная задержка - палевно!
            time.sleep(1)
            
            # Проверяем, что страница загрузилась
            if "band.link" in self.driver.current_url:
                print("✅ Успешно перешли на band.link/scanner")
                return True
            else:
                print(f"❌ Не удалось перейти на band.link. Текущий URL: {self.driver.current_url}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка перехода на band.link: {e}")
            return False

    def detect_captcha(self) -> bool:
        """Определяет наличие капчи на странице"""
        try:
            current_url = self.driver.current_url
            print(f"🔍 Проверяем капчу на URL: {current_url}")
            
            # ТЕСТОВЫЙ РЕЖИМ: Минимальная задержка
            time.sleep(0.5)
            
            # Проверяем URL на наличие капчи
            if 'captcha' in current_url.lower() or 'robot' in current_url.lower():
                print("🔒 Капча обнаружена в URL!")
                return True
            
            # Ищем iframe с капчей (расширенный поиск)
            iframe_selectors = [
                'iframe[src*="captcha"]',
                'iframe[src*="smartcaptcha"]', 
                'iframe[src*="yandex"]',
                'iframe[src*="recaptcha"]',
                'iframe[src*="hcaptcha"]',
                'iframe'
            ]
            
            for selector in iframe_selectors:
                iframes = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if iframes:
                    print(f"🔍 Найдено {len(iframes)} iframe по селектору: {selector}")
                    for i, iframe in enumerate(iframes):
                        src = iframe.get_attribute('src') or ''
                        print(f"  iframe {i+1}: {src[:100]}...")
                        if any(keyword in src.lower() for keyword in ['captcha', 'yandex', 'smartcaptcha']):
                            print(f"🔒 Найден iframe с капчей: {src[:100]}...")
                            return True
            
            # Ищем элементы капчи
            captcha_selectors = [
                '[class*="captcha"]',
                '[id*="captcha"]',
                '[class*="Captcha"]',
                '[id*="Captcha"]',
                '[class*="smartcaptcha"]',
                '[class*="yandex"]',
                '[class*="recaptcha"]',
                '[class*="hcaptcha"]'
            ]
            
            for selector in captcha_selectors:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"🔒 Найдено {len(elements)} элементов капчи по селектору: {selector}")
                    return True
            
            # Проверяем текст на странице
            page_text = self.driver.page_source.lower()
            captcha_keywords = [
                'captcha', 'robot', 'verify', 'security check', 'проверка',
                'smartcaptcha', 'yandex', 'recaptcha', 'hcaptcha',
                'i\'m not a robot', 'я не робот', 'проверка безопасности'
            ]
            
            for keyword in captcha_keywords:
                if keyword in page_text:
                    print(f"🔒 Капча обнаружена по ключевому слову: {keyword}")
                    return True
            
            print("✅ Капча не обнаружена")
            return False
            
        except Exception as e:
            print(f"⚠️ Ошибка детекта капчи: {e}")
            return False

    def solve_yandex_captcha(self) -> bool:
        """Решает Yandex SmartCaptcha через 2captcha (метод Coordinates)"""
        if not self.captcha_solver:
            print("❌ 2captcha не настроен! Невозможно решить капчу автоматически.")
            return False

        try:
            print("🔄 Отправляем Yandex SmartCaptcha в 2captcha (метод Coordinates)...")

            current_url = self.driver.current_url
            print(f"📍 URL: {current_url}")

            # Ищем iframe с капчей (расширенный поиск)
            print("🔍 Ищем iframe с Yandex SmartCaptcha...")
            iframe_selectors = [
                'iframe[src*="smartcaptcha"]',
                'iframe[src*="captcha-api.yandex"]',
                'iframe[src*="yandex"]',
                'iframe[src*="captcha"]',
                'iframe'
            ]
            
            iframes = []
            for selector in iframe_selectors:
                found_iframes = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if found_iframes:
                    print(f"🔍 Найдено {len(found_iframes)} iframe по селектору: {selector}")
                    for iframe in found_iframes:
                        src = iframe.get_attribute('src') or ''
                        print(f"  iframe: {src[:100]}...")
                        if any(keyword in src.lower() for keyword in ['captcha', 'yandex', 'smartcaptcha']):
                            iframes.append(iframe)
                            print(f"✅ Подходящий iframe найден: {src[:100]}...")
            
            if not iframes:
                print("❌ Iframe с капчей не найден!")
                print("🔍 Попробуем найти капчу другим способом...")
                
                # Ищем элементы капчи напрямую
                captcha_elements = self.driver.find_elements(By.CSS_SELECTOR, '[class*="captcha"], [id*="captcha"], [class*="smartcaptcha"]')
                if captcha_elements:
                    print(f"🔍 Найдено {len(captcha_elements)} элементов капчи на странице")
                    # Возможно, капча загружается динамически, подождем
                    time.sleep(5)
                    iframes = self.driver.find_elements(By.CSS_SELECTOR, 'iframe')
                    if iframes:
                        print(f"🔍 После ожидания найдено {len(iframes)} iframe")
                        for iframe in iframes:
                            src = iframe.get_attribute('src') or ''
                            if any(keyword in src.lower() for keyword in ['captcha', 'yandex', 'smartcaptcha']):
                                print(f"✅ Iframe найден после ожидания: {src[:100]}...")
                                iframes = [iframe]
                                break
                
                if not iframes:
                    print("❌ Капча не найдена ни в iframe, ни в элементах!")
                    return False

            captcha_iframe = iframes[0]
            print(f"✅ Найден iframe: {captcha_iframe.get_attribute('src')[:100]}...")

            # Переключаемся на iframe
            self.driver.switch_to.frame(captcha_iframe)
            time.sleep(2)

            # Ищем изображение капчи
            print("🔍 Ищем изображение капчи...")
            try:
                captcha_img = None
                selectors = [
                    'img[class*="captcha"]', 'img[class*="Captcha"]', 'canvas', 'img', '[class*="image"]'
                ]

                for selector in selectors:
                    imgs = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if imgs:
                        captcha_img = imgs[0]
                        print(f"✅ Найдено изображение по селектору: {selector}")
                        break

                if not captcha_img:
                    print("❌ Изображение капчи не найдено!")
                    self.driver.switch_to.default_content()
                    return False

                img_base64 = captcha_img.screenshot_as_base64
                print(f"✅ Получен скриншот капчи (размер: {len(img_base64)} символов)")

                # Ищем текст задания
                print("🔍 Ищем текст задания...")
                task_text = "Нажмите на все подходящие изображения"
                task_selectors = [
                    '[class*="task"]', '[class*="instruction"]', '[class*="text"]', 'div', 'span'
                ]

                for selector in task_selectors:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elements:
                        text = elem.text.strip()
                        if text and ('нажмите' in text.lower() or 'выберите' in text.lower() or 'click' in text.lower()):
                            task_text = text
                            print(f"✅ Найден текст задания: {task_text}")
                            break
                    if task_text != "Нажмите на все подходящие изображения":
                        break

                self.driver.switch_to.default_content()

                print(f"📤 Отправляем капчу в 2captcha...")
                print(f"   Задание: {task_text}")
                print(f"⏳ Ожидаем решения (обычно 20-60 секунд для Coordinates)...")

                result = self.captcha_solver.coordinates(
                    file=img_base64,
                    textinstructions=task_text,
                    lang='ru'
                )

                coordinates_str = result.get('code')
                print(f"✅ Капча решена! Координаты: {coordinates_str}")

                if not coordinates_str:
                    print("❌ Не получены координаты от 2captcha!")
                    return False

                coordinates = []
                for coord_pair in coordinates_str.split(';'):
                    if ':' in coord_pair:
                        x, y = map(int, coord_pair.split(':'))
                        coordinates.append((x, y))

                print(f"📍 Распарсено {len(coordinates)} точек для клика")

                self.driver.switch_to.frame(captcha_iframe)

                for i, (x, y) in enumerate(coordinates, 1):
                    print(f"🖱️  Клик {i}/{len(coordinates)} по координатам ({x}, {y})")
                    try:
                        action = ActionChains(self.driver)
                        action.move_to_element_with_offset(captcha_img, x, y).click().perform()
                        time.sleep(random.uniform(0.3, 0.7))
                    except Exception as e:
                        print(f"⚠️  Ошибка клика {i}: {e}")

                print("✅ Все клики выполнены")

                print("🔍 Ищем кнопку подтверждения...")
                submit_selectors = [
                    'button[type="submit"]', 'button[class*="submit"]', 'button[class*="button"]',
                    '[class*="CheckButton"]', 'button', 'input[type="submit"]'
                ]

                submit_btn = None
                for selector in submit_selectors:
                    buttons = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if buttons:
                        submit_btn = buttons[0]
                        print(f"✅ Найдена кнопка по селектору: {selector}")
                        break

                if submit_btn:
                    submit_btn.click()
                    print("✅ Кнопка подтверждения нажата")
                else:
                    print("⚠️  Кнопка подтверждения не найдена, пытаемся просто выйти из iframe")

                self.driver.switch_to.default_content()
                time.sleep(3)

                print("✅ Yandex SmartCaptcha решена успешно!")
                return True

            except Exception as e:
                print(f"❌ Ошибка обработки капчи: {e}")
                import traceback
                print(f"🔍 Трассировка: {traceback.format_exc()}")
                self.driver.switch_to.default_content()
                return False

        except Exception as e:
            print(f"❌ Критическая ошибка решения капчи через 2captcha: {e}")
            import traceback
            print(f"🔍 Трассировка: {traceback.format_exc()}")
            try:
                self.driver.switch_to.default_content()
            except:
                pass
            return False

    def search_artist(self, artist_name: str) -> bool:
        """Ищет артиста на странице"""
        try:
            print(f"🔍 Ищем артиста: {artist_name}")
            
            # Ищем поле поиска
            search_selectors = [
                'input[type="search"]', 'input[placeholder*="search"]', 'input[placeholder*="Search"]',
                'input[placeholder*="поиск"]', 'input[placeholder*="Поиск"]', 'input[name*="search"]',
                'input[id*="search"]', 'input[class*="search"]'
            ]
            
            search_input = None
            for selector in search_selectors:
                try:
                    search_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                    print(f"✅ Найдено поле поиска по селектору: {selector}")
                    break
                except NoSuchElementException:
                    continue
            
            if not search_input:
                print("❌ Поле поиска не найдено!")
                return False
            
            # Очищаем поле и вводим имя артиста
            search_input.clear()
            time.sleep(0.1)  # ТЕСТОВЫЙ РЕЖИМ: Быстро!
            search_input.send_keys(artist_name)
            time.sleep(0.2)  # ТЕСТОВЫЙ РЕЖИМ: Быстро!
            
            # Нажимаем Enter или ищем кнопку поиска
            try:
                search_input.send_keys(Keys.RETURN)
                print("✅ Поиск выполнен (Enter)")
            except:
                # Ищем кнопку поиска
                search_buttons = self.driver.find_elements(By.CSS_SELECTOR, 'button[type="submit"], button[class*="search"], button[class*="Search"]')
                if search_buttons:
                    search_buttons[0].click()
                    print("✅ Поиск выполнен (кнопка)")
                else:
                    print("⚠️ Кнопка поиска не найдена, полагаемся на Enter")
            
            # Ждем результатов поиска - ТЕСТОВЫЙ РЕЖИМ: Быстро!
            time.sleep(1)
            
            # Проверяем, появились ли результаты
            results_selectors = [
                '[class*="result"]', '[class*="artist"]', '[class*="card"]', 
                'article', 'div[class*="item"]', 'li[class*="item"]'
            ]
            
            for selector in results_selectors:
                results = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if results:
                    print(f"✅ Найдено {len(results)} результатов поиска")
                    return True
            
            print("⚠️ Результаты поиска не найдены")
            return False
            
        except Exception as e:
            print(f"❌ Ошибка поиска артиста: {e}")
            return False

    def parse_artist_playlists(self, artist_name: str) -> List[Dict]:
        """Парсит плейлисты артиста (как в оригинальном Windows парсере)"""
        try:
            print(f"📋 Парсим плейлисты для {artist_name}")
            
            playlists = []
            seen_playlists = set()  # Для отслеживания уникальных плейлистов
            
            # Ждем появления результатов
            time.sleep(random.uniform(2, 4))
            
            # Ищем первый article элемент
            try:
                article = self.driver.find_element(By.CSS_SELECTOR, 'article')
                print("✅ Найден article элемент")
            except NoSuchElementException:
                print("❌ Article элемент не найден!")
                return []
            
            # Ищем кнопку "Показать все" или "Смотреть все" в article
            button_clicked = False
            try:
                # Ищем по data-testid="load-more-button"
                show_all_buttons = article.find_elements(By.CSS_SELECTOR, '[data-testid="load-more-button"]')
                if not show_all_buttons:
                    # Если не найдено по data-testid, ищем по тексту
                    show_all_buttons = article.find_elements(By.CSS_SELECTOR, 'button, div[class*="cardMore"]')
                
                for button in show_all_buttons:
                    button_text = button.text.lower().strip()
                    if ("показать" in button_text or "смотреть" in button_text) and "все" in button_text:
                        if button.is_displayed():
                            print(f"✅ Найдена кнопка '{button.text}', нажимаем...")
                            # Прокручиваем к кнопке перед нажатием
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
                            time.sleep(1)
                            # Пробуем нажать кнопку через JavaScript если обычный клик не работает
                            try:
                                button.click()
                            except Exception as click_error:
                                print(f"⚠️ Обычный клик не сработал: {click_error}")
                                print("🔄 Пробуем клик через JavaScript...")
                                self.driver.execute_script("arguments[0].click();", button)
                            
                            button_clicked = True
                            print("✅ Кнопка нажата, ждем загрузки...")
                            time.sleep(random.uniform(3, 5))  # Ждем загрузки дополнительных плейлистов
                            break
                if not button_clicked:
                    print("ℹ️  Кнопка 'Показать все' не найдена")
            except Exception as e:
                print(f"⚠️ Ошибка с кнопкой 'Показать все': {e}")
            
            # Прокручиваем страницу только если кнопка была нажата
            if button_clicked:
                print("📜 Прокручиваем страницу для загрузки всех плейлистов...")
                self.scroll_to_load_all_playlists()
            else:
                print("ℹ️  Кнопка не была нажата, прокрутка не нужна")
            
            # Ищем первый контейнер card_artistType внутри article
            try:
                artist_type_container = article.find_element(By.CSS_SELECTOR, 'div[class*="card_artistType"]')
                print("✅ Найден контейнер card_artistType")
                
                # Внутри него ищем ВСЕ контейнеры плейлистов (horizontal и vertical - они динамические!)
                playlist_containers = []
                
                # Ищем card_horizontalContainer
                horizontal_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_horizontalContainer"]')
                if horizontal_containers:
                    print(f"✅ Найдено {len(horizontal_containers)} контейнеров (card_horizontalContainer)")
                    playlist_containers.extend(horizontal_containers)
                
                # Ищем card_verticalContainer
                vertical_containers = artist_type_container.find_elements(By.CSS_SELECTOR, 'div[class*="card_verticalContainer"]')
                if vertical_containers:
                    print(f"✅ Найдено {len(vertical_containers)} контейнеров (card_verticalContainer)")
                    playlist_containers.extend(vertical_containers)
                
                print(f"✅ Всего найдено {len(playlist_containers)} контейнеров плейлистов")
                
                for container in playlist_containers:
                    playlist_data = self.extract_playlist_data_from_container(container, artist_name)
                    if playlist_data and playlist_data['playlist_name']:
                        # Создаем уникальный ключ на основе названия и ссылки
                        playlist_key = f"{playlist_data['playlist_name']}_{playlist_data.get('playlist_url', '')}"
                        if playlist_key not in seen_playlists:
                            playlists.append(playlist_data)
                            seen_playlists.add(playlist_key)
                            print(f"  📝 {playlist_data['playlist_name']}")
                            if playlist_data.get('playlist_url'):
                                print(f"     🔗 {playlist_data['playlist_url'][:80]}...")
                            if playlist_data.get('playlist_cover_url'):
                                print(f"     🖼️  {playlist_data['playlist_cover_url'][:80]}...")
                            if playlist_data.get('platform'):
                                print(f"     🎵 {playlist_data['platform']}")
                        else:
                            print(f"  ⚠️  Пропущен дубликат: {playlist_data['playlist_name']}")
                
            except NoSuchElementException:
                print("❌ Контейнер card_artistType не найден!")
            
            if playlists:
                print(f"✅ Найдено {len(playlists)} плейлистов/треков")
            else:
                print("❌ Плейлисты не найдены")
            
            return playlists
            
        except Exception as e:
            print(f"❌ Ошибка парсинга плейлистов: {e}")
            return []

    def scroll_to_load_all_playlists(self):
        """Прокручивает страницу для загрузки всех плейлистов"""
        try:
            # Получаем начальную высоту страницы
            last_height = self.driver.execute_script("return document.body.scrollHeight")
            scroll_attempts = 0
            max_scroll_attempts = 5
            
            while scroll_attempts < max_scroll_attempts:
                # Прокручиваем вниз
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(random.uniform(2, 4))  # Ждем загрузки контента
                
                # Проверяем, увеличилась ли высота страницы
                new_height = self.driver.execute_script("return document.body.scrollHeight")
                if new_height == last_height:
                    print("✅ Достигнут конец страницы, больше контента нет")
                    break
                else:
                    print(f"📏 Высота страницы увеличилась с {last_height} до {new_height}")
                    last_height = new_height
                
                scroll_attempts += 1
            
            # Прокручиваем обратно вверх для лучшего парсинга
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(1)
            print("✅ Прокрутка завершена")
            
        except Exception as e:
            print(f"⚠️ Ошибка при прокрутке страницы: {e}")

    def extract_playlist_data_from_container(self, container, artist_name: str) -> Optional[Dict]:
        """Извлекает данные плейлиста из контейнера (как в оригинальном Windows парсере)"""
        try:
            playlist_data = {
                'artist_name': artist_name,
                'playlist_name': '',
                'playlist_artist': '',
                'track_names': '',
                'likes_count': '',
                'platform': '',
                'playlist_cover_url': '',
                'playlist_url': ''
            }
            
            # Ищем название плейлиста
            try:
                title_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTitle"], [data-testid="playlist-title"]')
                playlist_data['playlist_name'] = title_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем название трека
            try:
                track_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackTitle"]')
                playlist_data['track_names'] = track_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем исполнителей
            try:
                artists_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionInfoTrackArtists"], [data-testid="track-info"]')
                playlist_data['playlist_artist'] = artists_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Ищем ссылку на плейлист
            try:
                link_element = container.find_element(By.CSS_SELECTOR, 'a[href], [data-testid="playlist-link"]')
                playlist_data['playlist_url'] = link_element.get_attribute('href')
            except NoSuchElementException:
                pass
            
            # Ищем ссылку на обложку
            try:
                cover_element = container.find_element(By.CSS_SELECTOR, '[class*="playlist_musicCollectionCover"] img, [data-testid="playlist-cover"] img, img')
                playlist_data['playlist_cover_url'] = cover_element.get_attribute('src')
            except NoSuchElementException:
                pass
            
            # Ищем количество лайков/прослушиваний
            try:
                likes_element = container.find_element(By.CSS_SELECTOR, '[class*="likesCount"], [data-testid="likes-count"]')
                playlist_data['likes_count'] = likes_element.text.strip()
            except NoSuchElementException:
                pass
            
            # Определяем платформу по URL
            if playlist_data['playlist_url']:
                if 'music.mts.ru' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'МТС Музыка'
                elif 'music.yandex.ru' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'Яндекс Музыка'
                elif 'spotify.com' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'Spotify'
                elif 'music.apple.com' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'Apple Music'
                elif 'music.youtube.com' in playlist_data['playlist_url']:
                    playlist_data['platform'] = 'YouTube Music'
                else:
                    playlist_data['platform'] = 'Неизвестная платформа'
            
            return playlist_data
            
        except Exception as e:
            print(f"⚠️ Ошибка извлечения данных плейлиста: {e}")
            return None

    def save_playlists_to_db(self, artist_name: str, playlists: List[Dict]):
        """Сохраняет плейлисты в базу данных"""
        try:
            if not playlists:
                return
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            saved_count = 0
            updated_count = 0
            
            for playlist in playlists:
                try:
                    # Проверяем, существует ли плейлист
                    cursor.execute('''
                        SELECT id FROM playlists 
                        WHERE artist_name = ? AND playlist_name = ?
                    ''', (playlist['artist_name'], playlist['playlist_name']))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Обновляем существующий плейлист
                        cursor.execute('''
                            UPDATE playlists 
                            SET playlist_artist = ?, track_names = ?, likes_count = ?, 
                                platform = ?, playlist_cover_url = ?, playlist_url = ?, parsed_at = CURRENT_TIMESTAMP
                            WHERE artist_name = ? AND playlist_name = ?
                        ''', (
                            playlist.get('playlist_artist', ''),
                            playlist.get('track_names', ''),
                            playlist.get('likes_count', ''),
                            playlist.get('platform', ''),
                            playlist.get('playlist_cover_url', ''),
                            playlist.get('playlist_url', ''),
                            playlist['artist_name'],
                            playlist['playlist_name']
                        ))
                        updated_count += 1
                        print(f"  ✅ Обновлен: {playlist['playlist_name']}")
                    else:
                        # Создаем новый плейлист
                        cursor.execute('''
                            INSERT INTO playlists 
                            (artist_name, playlist_name, playlist_artist, track_names, likes_count, 
                             platform, playlist_cover_url, playlist_url, parsed_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ''', (
                            playlist['artist_name'],
                            playlist['playlist_name'],
                            playlist.get('playlist_artist', ''),
                            playlist.get('track_names', ''),
                            playlist.get('likes_count', ''),
                            playlist.get('platform', ''),
                            playlist.get('playlist_cover_url', ''),
                            playlist.get('playlist_url', '')
                        ))
                        saved_count += 1
                        print(f"  ✅ Добавлен: {playlist['playlist_name']}")
                        
                except Exception as e:
                    print(f"⚠️ Ошибка сохранения плейлиста {playlist.get('playlist_name', 'Unknown')}: {e}")
            
            conn.commit()
            conn.close()
            
            print(f"✅ Добавлено {saved_count} новых плейлистов, обновлено {updated_count}")
            
        except Exception as e:
            print(f"❌ Ошибка сохранения в базу данных: {e}")

    def trigger_captcha_test(self):
        """Специально вызывает капчу множественными быстрыми запросами - МАКСИМАЛЬНО НАГЛЫЙ РЕЖИМ"""
        print("\n" + "="*60)
        print("🤖 МАКСИМАЛЬНО НАГЛЫЙ РЕЖИМ: Вызываем капчу!")
        print("="*60)
        
        # Делаем 10 ОЧЕНЬ быстрых переходов на band.link
        for i in range(10):
            print(f"\n🔄 Попытка {i+1}/10: МГНОВЕННЫЙ переход на band.link...")
            try:
                self.driver.get("https://band.link/scanner")
                time.sleep(0.05)  # СУПЕР короткая задержка - МАКСИМАЛЬНО ПАЛЕВНО!
                
                # Проверяем капчу сразу
                if self.detect_captcha():
                    print("✅ Капча вызвана успешно!")
                    return True
                    
                # СУПЕР быстрые действия на странице
                try:
                    for j in range(5):  # Делаем 5 быстрых скроллов
                        self.driver.execute_script(f"window.scrollTo(0, {j * 100});")
                        time.sleep(0.01)
                    self.driver.execute_script("window.scrollTo(0, 0);")
                    time.sleep(0.01)
                except:
                    pass
                    
                # Дополнительные палевные действия
                try:
                    # Быстро кликаем по странице
                    self.driver.execute_script("document.body.click();")
                    time.sleep(0.01)
                except:
                    pass
                    
            except Exception as e:
                print(f"⚠️ Ошибка при попытке {i+1}: {e}")
        
        print("\n⚠️ Капча не вызвана после 10 попыток - странно!")
        return False

    def run_parsing_cycle(self):
        """Запускает цикл парсинга"""
        print("🚀 Запуск Bandlink парсера для Mac (локальное тестирование)")
        print("🤖 РЕЖИМ ТЕСТА КАПЧИ: Специально вызываем капчу!\n")

        if not self.setup_clean_driver():
            return False

        # Сначала пытаемся вызвать капчу
        self.trigger_captcha_test()

        if not self.navigate_to_scanner():
            print("❌ Ошибка перехода на страницу")
            self.driver.quit()
            return False

        # Проверяем капчу
        if self.detect_captcha():
            print("🔒 Обнаружена капча! Пытаемся решить...")
            if self.captcha_solver:
                if self.solve_yandex_captcha():
                    print("✅ Капча решена успешно!")
                    time.sleep(3)
                else:
                    print("❌ Не удалось решить капчу автоматически!")
                    print("⚠️  Продолжаем парсинг без решения капчи...")
                    print("💡 Возможно, капча не критична для работы парсера")
                    time.sleep(2)
            else:
                print("⚠️  2captcha не настроен. Продолжаем без решения капчи...")
                time.sleep(2)
        else:
            print("✅ Капча не обнаружена, продолжаем парсинг")

        # Парсим артистов
        artists = self.config.get('target_artists', [])
        if not artists:
            print("❌ Список артистов не настроен!")
            self.driver.quit()
            return False

        print(f"📋 Начинаем парсинг {len(artists)} артистов...")

        for i, artist in enumerate(artists, 1):
            try:
                print(f"\n{'='*50}")
                print(f"Артист {i}/{len(artists)}: {artist}")
                
                # Ищем артиста
                if not self.search_artist(artist):
                    print(f"❌ Артист {artist} не найден")
                    continue
                
                # Парсим плейлисты
                playlists = self.parse_artist_playlists(artist)
                
                if playlists:
                    # Сохраняем в базу данных
                    self.save_playlists_to_db(artist, playlists)
                    print(f"✅ Успешно обработан артист: {artist}")
                else:
                    print(f"⚠️  Плейлисты не найдены для артиста: {artist}")
                
                # Пауза между артистами
                if i < len(artists):
                    pause = random.uniform(3, 7)
                    print(f"⏳ Пауза {pause:.1f} секунд перед следующим артистом...")
                    time.sleep(pause)
                
            except Exception as e:
                print(f"❌ Ошибка обработки артиста {artist}: {e}")
                continue

        print(f"\n{'='*50}")
        print("🎉 Парсинг завершен!")
        print(f"📊 База данных: {self.db_path}")
        
        # НЕ закрываем браузер автоматически - пользователь хочет посмотреть капчу!
        print("\n⚠️  БРАУЗЕР НЕ ЗАКРЫТ! Вы можете посмотреть на капчу и результаты.")
        print("💡 Нажмите Enter, чтобы закрыть браузер...")
        try:
            input()
        except:
            time.sleep(30)  # Ждем 30 секунд если input не работает
        
        # Закрываем браузер
        self.driver.quit()
        return True

def main():
    """Главная функция"""
    print("=" * 60)
    print("🎵 Bandlink Parser для Mac - Локальное тестирование")
    print("=" * 60)
    
    # Ищем конфиг файл
    config_files = [
        'temp_bandlink_config.json',
        'bandlink_config.json',
        'config.json'
    ]
    
    config_file = None
    for cf in config_files:
        if os.path.exists(cf):
            config_file = cf
            break
    
    if not config_file:
        print("❌ Конфиг файл не найден!")
        print("💡 Создайте файл temp_bandlink_config.json с настройками")
        return
    
    print(f"📁 Используем конфиг: {config_file}")
    
    # Создаем парсер
    parser = BandlinkParserMac(config_file)
    
    # Запускаем парсинг
    success = parser.run_parsing_cycle()
    
    if success:
        print("✅ Парсинг завершен успешно!")
    else:
        print("❌ Парсинг завершен с ошибками")

if __name__ == "__main__":
    main()
