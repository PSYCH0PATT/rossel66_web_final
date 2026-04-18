#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zvonko Digital Parser - оптимизированная версия для Linux
Парсер релизов с Zvonko Digital с поддержкой выбора количества страниц
"""

import json
import time
import re
import traceback
import logging
import sys
import os
import platform
from datetime import datetime
from typing import Dict, List, Optional

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
except ImportError:
    print("Selenium не установлен. Установите: pip install selenium")
    sys.exit(1)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ZvonkoLinuxParser:
    """Парсер релизов с Zvonko Digital для Linux"""
    
    def __init__(self, max_pages: int = None):
        self.base_url = "https://account.zvonkodigital.com"
        self.releases_url = "https://account.zvonkodigital.com/music/releases"
        self.moderating_url = "https://account.zvonkodigital.com/music/moderating"
        self.editing_url = "https://account.zvonkodigital.com/music/editing"
        self.username = (os.environ.get("ZVONKO_USERNAME") or "").strip()
        if not self.username:
            raise ValueError("ZVONKO_USERNAME environment variable is required")
        self.password = os.environ.get("ZVONKO_PASSWORD")
        if not self.password:
            raise ValueError("Задайте переменную окружения ZVONKO_PASSWORD")
        self.driver = None
        self.max_pages = max_pages
        self.results: List[Dict] = []
        
        # Статусы для обработки
        self.STATUSES = ['Доставлен', 'Модерация', 'Отклонен']
        
        # Хранилище для сравнения статусов
        self.previous_releases: Dict[str, Dict] = {}
        
    def setup_driver(self) -> bool:
        """Настраивает WebDriver для Linux"""
        logger.info("🔧 Настройка Chrome WebDriver для Linux...")
        try:
            chrome_options = Options()
            
            # Headless режим для сервера
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-plugins')
            chrome_options.add_argument('--disable-images')
            chrome_options.add_argument('--disable-javascript')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Определяем пути для Linux
            is_linux = platform.system() == 'Linux'
            
            if is_linux:
                # Ищем Chrome/Chromium в стандартных путях
                chrome_paths = [
                    '/usr/bin/chromium-browser',  # Alpine
                    '/usr/bin/chromium',          # Debian/Ubuntu
                    '/usr/bin/google-chrome',     # Ubuntu
                    '/usr/bin/chromium-browser'   # Другие дистрибутивы
                ]
                
                chrome_binary = None
                for path in chrome_paths:
                    if os.path.exists(path):
                        chrome_binary = path
                        chrome_options.binary_location = path
                        logger.info(f"🐧 Найден Chrome: {path}")
                        break
                
                if not chrome_binary:
                    logger.warning("⚠️ Chrome не найден, пробуем стандартный путь")
                
                # Ищем chromedriver
                driver_paths = [
                    '/usr/bin/chromedriver',
                    '/usr/lib/chromium/chromedriver',
                    '/usr/local/bin/chromedriver',
                    '/opt/chromedriver/chromedriver'
                ]
                
                for driver_path in driver_paths:
                    if os.path.exists(driver_path):
                        service = webdriver.chrome.service.Service(driver_path)
                        self.driver = webdriver.Chrome(service=service, options=chrome_options)
                        logger.info(f"🐧 Найден ChromeDriver: {driver_path}")
                        break
                
                if not self.driver:
                    # Пробуем создать без указания пути
                    self.driver = webdriver.Chrome(options=chrome_options)
                    logger.info("🐧 Используем системный ChromeDriver")
            else:
                # Для других ОС
                self.driver = webdriver.Chrome(options=chrome_options)
                logger.info("🔧 Chrome WebDriver для не-Linux системы")
            
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            logger.info("✅ Chrome WebDriver успешно запущен")
            return True
            
        except WebDriverException as e:
            logger.error(f"❌ Ошибка запуска Chrome WebDriver: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при запуске WebDriver: {e}")
            return False
    
    def login_to_zvonko(self) -> bool:
        """Авторизация на Zvonko"""
        logger.info("🔐 Начало процесса авторизации на Zvonko...")
        try:
            logger.info(f"📍 Переход на страницу авторизации: {self.base_url}")
            self.driver.get(self.base_url)
            
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Ищем поля входа
            username_input = None
            password_input = None
            
            try:
                username_input = self.driver.find_element(By.NAME, "username")
                logger.info("✅ Найдено поле логина")
            except NoSuchElementException:
                logger.error("❌ Поле логина не найдено")
                return False
            
            try:
                password_input = self.driver.find_element(By.NAME, "password")
                logger.info("✅ Найдено поле пароля")
            except NoSuchElementException:
                logger.error("❌ Поле пароля не найдено")
                return False
            
            # Ввод данных
            logger.info("⌨️ Ввод данных авторизации...")
            username_input.clear()
            username_input.send_keys(self.username)
            
            password_input.clear()
            password_input.send_keys(self.password)
            
            # Поиск и нажатие кнопки входа
            try:
                submit_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
                logger.info("✅ Найдена кнопка входа")
                submit_input.submit()
            except NoSuchElementException:
                logger.error("❌ Кнопка входа не найдена")
                return False
            
            # Ожидание загрузки после входа
            time.sleep(5)
            
            # Проверка успешного входа
            logger.info("📍 Переход на страницу релизов...")
            self.driver.get(self.releases_url)
            
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            time.sleep(5)
            
            logger.info("✅ Авторизация успешно завершена")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при авторизации: {e}")
            return False
    
    def extract_release_data_from_element(self, release_element, release_num=1):
        """Извлекает данные из элемента релиза"""
        try:
            found_data = {}
            
            # Получаем весь текст элемента
            full_text = release_element.text.strip()
            
            # Поиск по дочерним элементам
            try:
                # Ищем название и исполнителя
                title_elements = release_element.find_elements(By.CSS_SELECTOR, "p.chakra-text.css-106kqq8")
                artist_elements = release_element.find_elements(By.CSS_SELECTOR, "p.chakra-text.css-uvztd0")
                
                if title_elements:
                    found_data['title'] = title_elements[0].text.strip()
                
                if artist_elements:
                    found_data['artist'] = artist_elements[0].text.strip()
                
                # Ранний выход для пустого контейнера (баг Zvonko когда 0 релизов на editing)
                # Пропускаем до поиска обложки/даты, чтобы не тратить 1–2 минуты на пустой элемент
                if not found_data.get('title') and not found_data.get('artist'):
                    logger.warning(f"⚠️ Пропущен пустой контейнер релиза #{release_num} (нет title и artist)")
                    return None
                
                # Ищем обложку - пробуем несколько селекторов
                img_elements = None
                img_selectors = [
                    "img.chakra-image.css-1phd9a0",  # Основной селектор
                    "img.chakra-image",  # Без конкретного класса
                    "img[class*='chakra-image']",  # Частичное совпадение класса
                    "img",  # Любое изображение
                ]
                
                for selector in img_selectors:
                    try:
                        img_elements = release_element.find_elements(By.CSS_SELECTOR, selector)
                        if img_elements:
                            logger.debug(f"✅ Найдено изображений с селектором '{selector}': {len(img_elements)}")
                            break
                    except:
                        continue
                
                if img_elements:
                    # Пробуем найти изображение с валидным src
                    for img_elem in img_elements:
                        try:
                            img_src = img_elem.get_attribute('src')
                            if img_src and img_src.strip():
                                # КОНВЕРТИРУЕМ blob URL в data URL (ИДЕНТИЧНО КОАЛЕ)
                                if img_src.startswith('blob:'):
                                    logger.info(f"🔄 Найден blob URL, конвертируем в data URL: {img_src[:50]}...")
                                    try:
                                        # ИДЕНТИЧНО КОАЛЕ: Конвертируем blob из img
                                        data_url = self.driver.execute_script("""
                                            var img = arguments[0];
                                            try {
                                                var canvas = document.createElement('canvas');
                                                var ctx = canvas.getContext('2d');
                                                canvas.width = img.naturalWidth;
                                                canvas.height = img.naturalHeight;
                                                ctx.drawImage(img, 0, 0);
                                                return {
                                                    success: true,
                                                    dataURL: canvas.toDataURL('image/jpeg', 0.8),
                                                    width: img.naturalWidth,
                                                    height: img.naturalHeight
                                                };
                                            } catch(e) {
                                                return {
                                                    success: false,
                                                    error: e.toString()
                                                };
                                            }
                                        """, img_elem)
                                        
                                        if data_url and data_url.get('success'):
                                            found_data['cover'] = data_url['dataURL']
                                            logger.info(f"✅ Blob URL конвертирован в data URL: {data_url['width']}x{data_url['height']}")
                                            break
                                        else:
                                            logger.warning(f"⚠️ Ошибка конвертации blob URL: {data_url.get('error', 'Unknown error') if data_url else 'No result'}")
                                    except Exception as e:
                                        logger.warning(f"⚠️ Ошибка при конвертации blob URL: {e}")
                                    continue
                                
                                # Игнорируем SVG placeholder'ы
                                if img_src.startswith('data:image/svg'):
                                    continue
                                
                                # Проверяем, что это валидный URL (http/https или относительный путь)
                                if 'http' in img_src or img_src.startswith('//') or img_src.startswith('/'):
                                    found_data['cover'] = img_src
                                    logger.debug(f"✅ Обложка найдена: {img_src[:50]}...")
                                    break
                        except:
                            continue
                
                if not found_data.get('cover'):
                    logger.warning(f"⚠️ Обложка не найдена для релиза #{release_num}")
                
                # Ищем текстовые элементы для других данных
                text_elements = release_element.find_elements(By.XPATH, ".//*[text()]")
                
                # ВАЖНО: Сначала ищем дату релиза по метке "Дата релиза" или "Дата старта"
                # Это правильная дата, а не дата создания!
                try:
                    # Ищем элемент с текстом "Дата релиза" или "Дата старта"
                    date_labels = ['Дата релиза', 'Дата старта', 'Release Date', 'Start Date']
                    for label in date_labels:
                        try:
                            label_elem = release_element.find_element(By.XPATH, f".//*[contains(text(), '{label}')]")
                            # Ищем следующий элемент со значением даты
                            # Может быть в следующем sibling или в следующем элементе
                            parent = label_elem.find_element(By.XPATH, "./..")
                            following_elems = parent.find_elements(By.XPATH, ".//*[text()]")
                            
                            for follow_elem in following_elems:
                                follow_text = follow_elem.text.strip()
                                if re.match(r'^\d{4}-\d{2}-\d{2}$', follow_text):
                                    found_data['date'] = follow_text
                                    logger.info(f"✅ Найдена дата релиза: {follow_text} (из метки '{label}')")
                                    break
                            
                            if found_data.get('date'):
                                break
                        except:
                            continue
                except:
                    pass
                
                # Если дата релиза не найдена по метке, ищем любую дату как fallback
                if not found_data.get('date'):
                    for elem in text_elements:
                        try:
                            elem_text = elem.text.strip()
                            if not elem_text or len(elem_text) < 2:
                                continue
                            
                            # Ищем даты (только если еще не нашли дату релиза)
                            if re.match(r'^\d{4}-\d{2}-\d{2}$', elem_text):
                                found_data['date'] = elem_text
                                logger.warning(f"⚠️ Использована дата без метки (может быть дата создания): {elem_text}")
                                break
                        except:
                            continue
                
                for elem in text_elements:
                    try:
                        elem_text = elem.text.strip()
                        if not elem_text or len(elem_text) < 2:
                            continue
                        
                        # Ищем UPC
                        if re.match(r'^\d{12,14}$', elem_text):
                            if not found_data.get('upc'):
                                found_data['upc'] = elem_text
                        
                        # Ищем лейбл
                        elif 'ROSSEL' in elem_text:
                            if not found_data.get('label'):
                                found_data['label'] = elem_text
                        
                        # Ищем жанр
                        elif elem_text in ['Hip Hop', 'Rap', 'Pop', 'Rock', 'Electronic', 'Hip Hop/Rap', 'Phonk/Fonk']:
                            if not found_data.get('genre'):
                                found_data['genre'] = elem_text
                        
                        # Ищем территории
                        elif 'Все страны' in elem_text or 'Worldwide' in elem_text:
                            if not found_data.get('territories'):
                                found_data['territories'] = elem_text
                        
                        # Ищем количество площадок
                        elif elem_text.isdigit() and int(elem_text) > 10 and int(elem_text) < 1000:
                            if not found_data.get('platforms'):
                                found_data['platforms'] = elem_text
                    
                    except Exception:
                        continue
                        
            except Exception as e:
                logger.debug(f"⚠️ Ошибка поиска по селекторам: {e}")
            
            # Извлекаем статус
            found_data['status'] = self.extract_release_status(release_element)
            
            return found_data
            
        except Exception as e:
            logger.error(f"❌ Ошибка извлечения данных из релиза #{release_num}: {e}")
            return None
    
    def parse_current_page(self, page_num=1):
        """Парсит релизы на текущей странице"""
        try:
            time.sleep(3)
            
            # Прокрутка для загрузки всех элементов
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
            
            # Ищем контейнеры релизов
            release_containers = []
            
            main_selectors = [
                'div.css-1xgpa60',
                'div.chakra-stack.css-muke40',
            ]
            
            for selector in main_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор '{selector}': найдено {len(elements)} элементов")
                    if len(elements) >= 1:  # Изменено с > 1 на >= 1 для обработки одного релиза
                        # Проверяем, что это действительно контейнеры релизов
                        if len(elements) == 1:
                            first_elem = elements[0]
                            child_releases = first_elem.find_elements(By.CSS_SELECTOR, "div.css-1xgpa60, div.chakra-stack.css-muke40")
                            if len(child_releases) > 0:
                                logger.info(f"🔍 Найден родительский контейнер с {len(child_releases)} дочерними релизами")
                                release_containers = child_releases
                            else:
                                logger.info(f"🔍 Найден один элемент, проверяем как релиз")
                                release_containers = elements
                        else:
                            release_containers = elements
                        logger.info(f"📊 На странице #{page_num} найдено {len(release_containers)} релизов")
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка при поиске по селектору '{selector}': {e}")
                    continue
            
            if not release_containers:
                logger.warning(f"⚠️ На странице #{page_num} контейнеры не найдены")
                return []
            
            # Парсим каждый релиз
            page_releases = []
            for i, release in enumerate(release_containers):
                release_global_num = (page_num - 1) * len(release_containers) + i + 1
                
                # Извлекаем данные
                data = self.extract_release_data_from_element(release, release_global_num)
                if data:
                    # Статус уже извлечен в extract_release_data_from_element
                    # Если статус не был найден, устанавливаем по умолчанию
                    if not data.get('status'):
                        data['status'] = 'Доставлен'  # По умолчанию для страницы releases
                    data['source_page'] = 'releases'
                    data['page'] = page_num
                    data['position_on_page'] = i + 1
                    page_releases.append(data)
            
            logger.info(f"✅ Страница #{page_num} завершена! Обработано {len(page_releases)} релизов")
            return page_releases
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга страницы #{page_num}: {e}")
            return []
    
    def parse_all_pages(self):
        """Парсит все страницы с учетом лимита"""
        logger.info("🔍 Начало парсинга всех страниц...")
        
        all_releases = []
        current_page = 1
        
        try:
            while True:
                # Проверяем лимит страниц
                if self.max_pages and current_page > self.max_pages:
                    logger.info(f"🛑 Достигнут лимит страниц ({self.max_pages})")
                    break
                
                logger.info(f"\n📄 Обработка страницы #{current_page}...")
                
                # Парсим текущую страницу
                page_releases = self.parse_current_page(current_page)
                all_releases.extend(page_releases)
                
                # Проверяем, есть ли кнопка "предыдущая"
                try:
                    prev_button = self.driver.find_element(By.CSS_SELECTOR, '.page-previous-button')
                    
                    # Проверяем, активна ли кнопка
                    disabled_class = 'page-next-prev-button-disabled'
                    if disabled_class in prev_button.get_attribute('class'):
                        logger.info("✅ Достигнута первая страница")
                        break
                    
                    # Нажимаем кнопку "предыдущая"
                    logger.info("🖱️ Переход к предыдущей странице...")
                    prev_button.click()
                    time.sleep(3)
                    
                    current_page += 1
                    
                except NoSuchElementException:
                    logger.info("✅ Кнопка 'предыдущая' не найдена")
                    break
                except Exception as e:
                    logger.error(f"❌ Ошибка при переходе: {e}")
                    break
            
            logger.info(f"✅ Парсинг завершен! Всего обработано {len(all_releases)} релизов с {current_page-1} страниц")
            
            # Сохраняем результаты
            # Используем абсолютный путь, чтобы файл сохранялся в правильной директории
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_file = os.path.join(script_dir, 'zvonko_all_releases_full.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_releases, f, ensure_ascii=False, indent=2)
            
            self.results = all_releases
            return all_releases
            
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге всех страниц: {e}")
            return False
    
    def extract_release_status(self, release_element) -> str:
        """Извлекает статус релиза из элемента"""
        try:
            # Ищем статус в текстовых элементах
            text_elements = release_element.find_elements(By.XPATH, ".//*[text()]")
            for elem in text_elements:
                try:
                    elem_text = elem.text.strip()
                    if elem_text in self.STATUSES:
                        return elem_text
                except:
                    continue
            
            # Если статус не найден в текстовых элементах, ищем в полном тексте
            full_text = release_element.text.strip()
            for status in self.STATUSES:
                if status in full_text:
                    return status
            
            return 'Доставлен'  # По умолчанию "Доставлен", если статус не найден
            
        except Exception as e:
            logger.error(f"❌ Ошибка извлечения статуса: {e}")
            return 'Доставлен'  # По умолчанию "Доставлен"
    
    def parse_moderating_page(self):
        """Парсит страницу модерации - ИДЕНТИЧНО основной странице"""
        logger.info("🔍 Парсинг страницы модерации...")
        try:
            self.driver.get(self.moderating_url)
            time.sleep(6)  # Увеличенный таймаут в 2 раза
            
            # Ждем загрузки основных селекторов
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.css-1xgpa60, div.chakra-stack.css-muke40"))
                )
                logger.info("✅ Элементы загрузились")
            except:
                logger.warning("⚠️ Элементы не загрузились за 10 секунд")
            
            # ИСПОЛЬЗУЕМ ТОЧНО ТАКУЮ ЖЕ ЛОГИКУ КАК parse_current_page
            # Прокрутка для загрузки всех элементов
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)  # Увеличенный таймаут в 2 раза
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(4)  # Увеличенный таймаут в 2 раза
            
            # Дополнительная прокрутка вниз перед парсингом
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Ищем контейнеры релизов - ТОЧНО КАК НА ОСНОВНОЙ СТРАНИЦЕ
            release_containers = []
            
            main_selectors = [
                'div.css-1xgpa60',
                'div.chakra-stack.css-muke40',
            ]
            
            for selector in main_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор '{selector}': найдено {len(elements)} элементов")
                    if len(elements) >= 1:  # Изменено с > 1 на >= 1 для обработки одного релиза
                        # Проверяем, что это действительно контейнеры релизов
                        if len(elements) == 1:
                            first_elem = elements[0]
                            child_releases = first_elem.find_elements(By.CSS_SELECTOR, "div.css-1xgpa60, div.chakra-stack.css-muke40")
                            if len(child_releases) > 0:
                                logger.info(f"🔍 Найден родительский контейнер с {len(child_releases)} дочерними релизами")
                                release_containers = child_releases
                            else:
                                logger.info(f"🔍 Найден один элемент, проверяем как релиз")
                                release_containers = elements
                        else:
                            release_containers = elements
                        logger.info(f"📊 На странице moderating найдено {len(release_containers)} релизов")
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка при поиске по селектору '{selector}': {e}")
                    continue
            
            if not release_containers:
                logger.warning(f"⚠️ На странице moderating контейнеры не найдены")
                return []
            
            # ПАРСИМ ТОЧНО КАК В parse_current_page
            moderating_releases = []
            for i, release in enumerate(release_containers):
                release_global_num = (1 - 1) * len(release_containers) + i + 1
                
                # Извлекаем данные - ТОЧНО КАК НА ОСНОВНОЙ
                data = self.extract_release_data_from_element(release, release_global_num)
                if data:
                    data['status'] = 'Модерация'
                    data['source_page'] = 'moderating'
                    data['page'] = 1
                    data['position_on_page'] = i + 1
                    moderating_releases.append(data)
                    logger.info(f"  ✅ {data.get('title', 'N/A')} ({data.get('artist', 'N/A')}) - Модерация")
            
            logger.info(f"✅ Страница #{1} завершена! Обработано {len(moderating_releases)} релизов")
            return moderating_releases
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга страницы #{1}: {e}")
            return []
    
    def parse_editing_page(self):
        """Парсит страницу редактирования - ИДЕНТИЧНО основной странице"""
        logger.info("🔍 Парсинг страницы редактирования...")
        try:
            self.driver.get(self.editing_url)
            time.sleep(6)  # Увеличенный таймаут в 2 раза
            
            # Ждем загрузки основных селекторов
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "div.css-1xgpa60, div.chakra-stack.css-muke40"))
                )
                logger.info("✅ Элементы загрузились")
            except:
                logger.warning("⚠️ Элементы не загрузились за 10 секунд")
            
            # ИСПОЛЬЗУЕМ ТОЧНО ТАКУЮ ЖЕ ЛОГИКУ КАК parse_current_page
            # Прокрутка для загрузки всех элементов
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)  # Увеличенный таймаут в 2 раза
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(4)  # Увеличенный таймаут в 2 раза
            
            # Дополнительная прокрутка вниз перед парсингом
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Ищем контейнеры релизов - ТОЧНО КАК НА ОСНОВНОЙ СТРАНИЦЕ
            release_containers = []
            
            main_selectors = [
                'div.css-1xgpa60',
                'div.chakra-stack.css-muke40',
            ]
            
            for selector in main_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор '{selector}': найдено {len(elements)} элементов")
                    if len(elements) >= 1:  # Изменено с > 1 на >= 1 для обработки одного релиза
                        # Проверяем, что это действительно контейнеры релизов, а не общий контейнер
                        # Если элементов много, это скорее всего релизы
                        # Если элемент один, проверяем его содержимое
                        if len(elements) == 1:
                            # Проверяем, есть ли внутри дочерние элементы с релизами
                            first_elem = elements[0]
                            child_releases = first_elem.find_elements(By.CSS_SELECTOR, "div.css-1xgpa60, div.chakra-stack.css-muke40")
                            if len(child_releases) > 0:
                                logger.info(f"🔍 Найден родительский контейнер с {len(child_releases)} дочерними релизами")
                                release_containers = child_releases
                            else:
                                # Если дочерних нет, возможно это сам релиз
                                logger.info(f"🔍 Найден один элемент, проверяем как релиз")
                                release_containers = elements
                        else:
                            release_containers = elements
                        logger.info(f"📊 На странице editing найдено {len(release_containers)} релизов")
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка при поиске по селектору '{selector}': {e}")
                    continue
            
            if not release_containers:
                logger.warning(f"⚠️ На странице editing контейнеры не найдены")
                # Дополнительная диагностика: сохраняем HTML для анализа
                try:
                    page_source = self.driver.page_source
                    logger.debug(f"📄 Длина HTML страницы: {len(page_source)} символов")
                    # Ищем альтернативные селекторы
                    alt_selectors = [
                        'div[class*="css-"]',
                        'div[class*="chakra"]',
                        '[class*="release"]',
                        '[class*="music"]'
                    ]
                    for alt_sel in alt_selectors:
                        try:
                            alt_elements = self.driver.find_elements(By.CSS_SELECTOR, alt_sel)
                            if len(alt_elements) > 0:
                                logger.info(f"🔍 Альтернативный селектор '{alt_sel}': найдено {len(alt_elements)} элементов")
                        except:
                            pass
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка диагностики: {e}")
                return []
            
            # ПАРСИМ ТОЧНО КАК В parse_current_page
            editing_releases = []
            for i, release in enumerate(release_containers):
                release_global_num = (1 - 1) * len(release_containers) + i + 1
                
                # Извлекаем данные - ТОЧНО КАК НА ОСНОВНОЙ
                data = self.extract_release_data_from_element(release, release_global_num)
                if data:
                    data['status'] = 'Отклонен'
                    data['source_page'] = 'editing'
                    data['page'] = 1
                    data['position_on_page'] = i + 1
                    editing_releases.append(data)
                    logger.info(f"  ✅ {data.get('title', 'N/A')} ({data.get('artist', 'N/A')}) - Отклонен")
            
            logger.info(f"✅ Страница #{1} завершена! Обработано {len(editing_releases)} релизов")
            return editing_releases
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга страницы #{1}: {e}")
            return []
    
    def update_statuses_based_on_changes(self, releases_page, moderating_page, editing_page):
        """Обновляет статусы на основе изменений между страницами"""
        logger.info("🔄 Анализ изменений статусов...")
        
        # Создаем словари для быстрого поиска по артисту и названию
        def create_key(release):
            return f"{release.get('artist', '').lower()}_{release.get('title', '').lower()}"
        
        releases_dict = {create_key(r): r for r in releases_page}
        moderating_dict = {create_key(r): r for r in moderating_page}
        editing_dict = {create_key(r): r for r in editing_page}
        
        updated_releases = []
        
        # Проверяем релизы из модерации
        for key, moderating_release in moderating_dict.items():
            # Если релиз был в редактировании и теперь в модерации
            if key in editing_dict:
                logger.info(f"🔄 {moderating_release.get('title')} - Отклонен → Модерация")
                updated_release = moderating_release.copy()
                updated_release['status'] = 'Модерация'
                updated_release['previous_status'] = 'Отклонен'
                updated_releases.append(updated_release)
        
        # Проверяем релизы из основного списка
        for key, release in releases_dict.items():
            # Если релиз был в модерации и теперь доставлен
            if key in moderating_dict:
                logger.info(f"🔄 {release.get('title')} - Модерация → Доставлен")
                updated_release = release.copy()
                updated_release['status'] = 'Доставлен'
                updated_release['previous_status'] = 'Модерация'
                updated_releases.append(updated_release)
        
        logger.info(f"✅ Обновлено {len(updated_releases)} статусов")
        return updated_releases
    
    def parse_all_pages_with_status_updates(self):
        """Парсит все страницы с обновлением статусов"""
        logger.info("🔍 Начало полного парсинга с обновлением статусов...")
        
        try:
            # 1. Парсим основную страницу релизов
            logger.info("\n📄 Шаг 1: Парсинг основной страницы релизов...")
            self.driver.get(self.releases_url)
            time.sleep(3)
            releases_page = self.parse_all_pages()
            
            # 2. Парсим страницу модерации
            logger.info("\n📄 Шаг 2: Парсинг страницы модерации...")
            moderating_page = self.parse_moderating_page()
            
            # 3. Парсим страницу редактирования
            logger.info("\n📄 Шаг 3: Парсинг страницы редактирования...")
            editing_page = self.parse_editing_page()
            
            # 4. Обновляем статусы
            logger.info("\n🔄 Шаг 4: Анализ и обновление статусов...")
            updated_releases = self.update_statuses_based_on_changes(releases_page, moderating_page, editing_page)
            
            # 5. Объединяем все результаты
            all_results = releases_page + moderating_page + editing_page + updated_releases
            
            # Обновляем результаты парсера
            self.results = all_results
            
            # ВАЖНО: Сохраняем объединенные результаты в файл для сравнения
            # Это гарантирует, что все релизы (включая с модерации и редактирования) попадут в файл
            # Используем абсолютный путь, чтобы файл сохранялся в правильной директории
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_file = os.path.join(script_dir, 'zvonko_all_releases_full.json')
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2)
            
            # Проверяем, что файл сохранен правильно
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    saved_data = json.load(f)
                logger.info(f"✅ Файл {output_file} сохранен: {len(saved_data)} релизов")
                
                # Проверяем статусы в сохраненном файле
                statuses_count = {}
                for r in saved_data:
                    status = r.get('status', 'Неизвестен')
                    statuses_count[status] = statuses_count.get(status, 0) + 1
                
                logger.info(f"📊 Статусы в сохраненном файле:")
                for status, count in statuses_count.items():
                    logger.info(f"   - {status}: {count}")
            except Exception as e:
                logger.error(f"❌ Ошибка проверки сохраненного файла: {e}")
            
            logger.info(f"✅ Полный парсинг завершен!")
            logger.info(f"   - Основные релизы: {len(releases_page)}")
            logger.info(f"   - На модерации: {len(moderating_page)}")
            logger.info(f"   - Отклоненные: {len(editing_page)}")
            logger.info(f"   - Обновлено статусов: {len(updated_releases)}")
            logger.info(f"   - Всего: {len(all_results)}")
            logger.info(f"📄 Все результаты сохранены в {output_file}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка полного парсинга: {e}")
            return False
    
    def run_parser(self):
        """Запускает полный парсер с обновлением статусов"""
        logger.info("🚀 Запуск Zvonko Parser с обновлением статусов...")
        
        try:
            if not self.setup_driver():
                logger.error("❌ Не удалось настроить WebDriver")
                return False
            
            if not self.login_to_zvonko():
                logger.error("❌ Не удалось авторизоваться")
                return False
            
            if not self.parse_all_pages_with_status_updates():
                logger.error("❌ Не удалось выполнить полный парсинг")
                return False
            
            logger.info("✅ Парсинг успешно завершен!")
            return True
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка: {e}")
            return False
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                    logger.info("🔚 WebDriver закрыт")
                except Exception as e:
                    logger.error(f"❌ Ошибка закрытия WebDriver: {e}")

def main():
    """Главная функция"""
    # Получаем количество страниц из аргументов
    max_pages = None
    if len(sys.argv) > 1:
        try:
            max_pages = int(sys.argv[1])
            logger.info(f"📊 Установлен лимит страниц: {max_pages}")
        except ValueError:
            logger.warning("⚠️ Неверный формат лимита страниц")
    
    parser = ZvonkoLinuxParser(max_pages)
    success = parser.run_parser()
    
    # Всегда выводим JSON, даже при ошибках, чтобы API мог обработать результат
    print("JSON_OUTPUT_START")
    try:
        print(json.dumps(parser.results, ensure_ascii=False))
    except Exception as e:
        logger.error(f"❌ Ошибка сериализации JSON: {e}")
        print(json.dumps([], ensure_ascii=False))  # Выводим пустой массив при ошибке
    print("JSON_OUTPUT_END")
    
    if success:
        logger.info("🎉 Парсинг успешно завершен!")
        sys.exit(0)
    else:
        logger.error("💥 Парсинг завершился с ошибками!")
        sys.exit(1)

if __name__ == "__main__":
    main()
