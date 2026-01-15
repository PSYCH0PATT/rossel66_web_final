#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Zvonko Analyzer - Анализ страницы релизов для определения структуры DOM
"""

import json
import time
import os
import re
import traceback
import logging
from datetime import datetime
from typing import Dict, List, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('zvonko_analyzer.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ZvonkoAnalyzer:
    def __init__(self):
        self.driver = None
        self.login = "rossel_66"
        self.password = "rossel_66_27122023"
        self.base_url = "https://account.zvonkodigital.com"
        self.releases_url = "https://account.zvonkodigital.com/music/releases"
        
    def setup_driver(self):
        """Настраивает WebDriver"""
        logger.info("🔧 Настройка Chrome WebDriver...")
        try:
            chrome_options = Options()
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--start-maximized')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            chrome_options.add_argument('--disable-blink-features=AutomationControlled')
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            logger.info("🚀 Запуск Chrome WebDriver...")
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(10)
            
            logger.info("✅ Chrome WebDriver успешно запущен")
            return True
        except WebDriverException as e:
            logger.error(f"❌ Ошибка запуска Chrome WebDriver: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при запуске WebDriver: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
    
    def login_to_zvonko(self):
        """Авторизация на Zvonko"""
        logger.info("🔐 Начало процесса авторизации на Zvonko...")
        try:
            logger.info(f"📍 Переход на страницу авторизации: {self.base_url}")
            self.driver.get(self.base_url)
            
            # Ожидание загрузки страницы
            logger.info("⏳ Ожидание загрузки страницы...")
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            logger.info("✅ Страница загрузилась")
            
            # Проверяем текущий URL
            current_url = self.driver.current_url
            logger.info(f"📍 Текущий URL: {current_url}")
            
            # Сохраняем страницу входа для анализа
            with open('zvonko_login_page.html', 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
            logger.info("📄 Страница входа сохранена в zvonko_login_page.html")
            
            # Ищем форму входа
            logger.info("🔍 Поиск полей входа...")
            login_selectors = [
                'input[name="login"]',
                'input[name="username"]',
                'input[type="email"]',
                'input[placeholder*="Логин"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="login"]',
                'input[placeholder*="email"]',
                'input[id*="login"]',
                'input[id*="email"]'
            ]
            
            password_selectors = [
                'input[name="password"]',
                'input[type="password"]',
                'input[placeholder*="Пароль"]',
                'input[placeholder*="пароль"]',
                'input[placeholder*="Password"]',
                'input[id*="password"]'
            ]
            
            login_input = None
            password_input = None
            
            # Поиск полей входа с детальным логированием
            for i, selector in enumerate(login_selectors):
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор логина #{i+1} '{selector}': найдено {len(elements)} элементов")
                    if elements:
                        login_input = elements[0]
                        logger.info(f"✅ Найдено поле логина: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка поиска поля логина '{selector}': {e}")
                    continue
            
            for i, selector in enumerate(password_selectors):
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор пароля #{i+1} '{selector}': найдено {len(elements)} элементов")
                    if elements:
                        password_input = elements[0]
                        logger.info(f"✅ Найдено поле пароля: {selector}")
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка поиска поля пароля '{selector}': {e}")
                    continue
            
            if not login_input or not password_input:
                logger.error("❌ Не найдены поля входа")
                
                # Дополнительный анализ страницы
                all_inputs = self.driver.find_elements(By.TAG_NAME, "input")
                logger.info(f"🔍 Всего найдено input элементов: {len(all_inputs)}")
                for i, inp in enumerate(all_inputs):
                    try:
                        input_type = inp.get_attribute('type')
                        input_name = inp.get_attribute('name')
                        input_placeholder = inp.get_attribute('placeholder')
                        input_id = inp.get_attribute('id')
                        logger.info(f"  Input #{i+1}: type={input_type}, name={input_name}, placeholder={input_placeholder}, id={input_id}")
                    except:
                        pass
                
                return False
            
            # Вводим данные
            logger.info("⌨️ Ввод логина...")
            login_input.clear()
            login_input.send_keys(self.login)
            logger.info(f"✅ Логин '{self.login}' введен")
            
            logger.info("⌨️ Ввод пароля...")
            password_input.clear()
            password_input.send_keys(self.password)
            logger.info("✅ Пароль введен")
            
            # Ищем кнопку входа
            logger.info("🔍 Поиск кнопки входа...")
            login_button_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:contains("Войти")',
                'button:contains("Login")',
                'button:contains("Войти в систему")',
                '.login-button',
                '.auth-button',
                '.btn-primary',
                'button[class*="login"]',
                'button[class*="auth"]'
            ]
            
            login_button = None
            for i, selector in enumerate(login_button_selectors):
                try:
                    if ":contains(" in selector:
                        # Для XPath contains
                        text = selector.split('\"')[1]
                        xpath = f"//button[contains(text(), '{text}')]"
                        elements = self.driver.find_elements(By.XPATH, xpath)
                        logger.info(f"🔍 XPath кнопки #{i+1} '{xpath}': найдено {len(elements)} элементов")
                        if elements:
                            login_button = elements[0]
                            logger.info(f"✅ Найдена кнопка входа: {selector}")
                            break
                    else:
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        logger.info(f"🔍 Селектор кнопки #{i+1} '{selector}': найдено {len(elements)} элементов")
                        if elements:
                            login_button = elements[0]
                            logger.info(f"✅ Найдена кнопка входа: {selector}")
                            break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка поиска кнопки '{selector}': {e}")
                    continue
            
            if not login_button:
                logger.error("❌ Кнопка входа не найдена")
                
                # Ищем все кнопки
                all_buttons = self.driver.find_elements(By.TAG_NAME, "button")
                logger.info(f"🔍 Всего найдено button элементов: {len(all_buttons)}")
                for i, btn in enumerate(all_buttons):
                    try:
                        btn_text = btn.text.strip()
                        btn_type = btn.get_attribute('type')
                        btn_class = btn.get_attribute('class')
                        logger.info(f"  Button #{i+1}: text='{btn_text}', type={btn_type}, class={btn_class}")
                    except:
                        pass
                
                return False
            
            # Нажимаем кнопку входа
            logger.info("🖱️ Нажатие кнопки входа...")
            login_button.click()
            logger.info("✅ Кнопка входа нажата")
            
            # Ожидаем результат
            logger.info("⏳ Ожидание результата входа...")
            time.sleep(5)
            
            # Проверяем успешность входа
            current_url = self.driver.current_url
            logger.info(f"📍 URL после входа: {current_url}")
            
            # Проверяем наличие признаков успешного входа
            page_title = self.driver.title
            logger.info(f"📄 Заголовок страницы: {page_title}")
            
            # Переход на страницу релизов
            logger.info("🎵 Переход на страницу релизов...")
            self.driver.get(self.releases_url)
            
            logger.info("⏳ Ожидание загрузки страницы релизов...")
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            current_url = self.driver.current_url
            logger.info(f"📍 URL страницы релизов: {current_url}")
            
            time.sleep(3)
            logger.info("✅ Авторизация успешно завершена")
            return True
            
        except TimeoutException as e:
            logger.error(f"❌ Таймаут при авторизации: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
        except WebDriverException as e:
            logger.error(f"❌ Ошибка WebDriver при авторизации: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
        except Exception as e:
            logger.error(f"❌ Неожиданная ошибка при авторизации: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
    
    def analyze_releases_page(self):
        """Анализирует страницу релизов и определяет структуру"""
        logger.info("🔍 Начало анализа страницы релизов...")
        try:
            # Ожидаем полной загрузки динамического контента
            logger.info("⏳ Ожидание загрузки контента...")
            time.sleep(5)
            
            # Пробуем прокрутить страницу для загрузки всех элементов
            logger.info("📜 Прокрутка страницы для загрузки всех элементов...")
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
            
            # Сохраняем HTML для анализа
            logger.info("💾 Сохранение HTML страницы...")
            html_content = self.driver.page_source
            with open('zvonko_releases_page.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            logger.info("📄 HTML страницы сохранен в zvonko_releases_page.html")
            
            # Проверяем размер HTML
            html_size = len(html_content)
            logger.info(f"📊 Размер HTML: {html_size} символов")
            
            # Ищем таблицу или контейнер с релизами
            release_containers = []
            
            # Возможные селекторы для контейнеров релизов (обновленные на основе анализа)
            container_selectors = [
                'div.css-1xgpa60',  # Точный селектор из анализа HTML
                'div.chakra-stack.css-1xgpa60',  # Более полный селектор
                '[class*="css-1xgpa60"]',  # Fallback вариант
                'table tbody tr',
                'table tr',
                '.table tbody tr',
                '[class*="release"]',
                '[class*="music"]',
                '[class*="track"]',
                '.row',
                '[class*="item"]',
                '[class*="record"]',
                '[class*="album"]',
                'tr[class*="row"]',
                'div[class*="release"]',
                '.data-row',
                '[role="row"]',
                'tbody tr',
                '.ant-table-tbody tr',  # Ant Design таблицы
                '.MuiTableRow-root',    # Material-UI таблицы
                '[class*="table-row"]'
            ]
            
            logger.info("🔍 Поиск контейнеров с релизами...")
            for i, selector in enumerate(container_selectors):
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор #{i+1} '{selector}': найдено {len(elements)} элементов")
                    if len(elements) > 1:  # Должно быть несколько релизов
                        logger.info(f"✅ Найдено {len(elements)} элементов по селектору: {selector}")
                        release_containers = elements
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка поиска по селектору '{selector}': {e}")
                    continue
            
            if not release_containers:
                logger.error("❌ Контейнеры с релизами не найдены")
                
                # Пробуем найти по текстовым паттернам
                logger.info("🔍 Поиск по текстовым паттернам...")
                try:
                    text_patterns = [
                        "//*[contains(text(), 'GOLD TIME')]",
                        "//*[contains(text(), 'ripznxx')]", 
                        "//*[contains(text(), '5063833652308')]",
                        "//*[contains(text(), 'Stfu')]",
                        "//*[contains(text(), 'BRXVKDXWN')]"
                    ]
                    
                    for pattern in text_patterns:
                        try:
                            elements = self.driver.find_elements(By.XPATH, pattern)
                            logger.info(f"🔍 Паттерн '{pattern}': найдено {len(elements)} элементов")
                            if elements:
                                # Ищем родительские контейнеры
                                for elem in elements[:3]:
                                    try:
                                        parent = elem.find_element(By.XPATH, "./ancestor::tr")
                                        if parent not in release_containers:
                                            release_containers.append(parent)
                                            logger.info(f"✅ Найден родительский TR для элемента")
                                    except:
                                        try:
                                            parent = elem.find_element(By.XPATH, "./ancestor::div[contains(@class, 'row')]")
                                            if parent not in release_containers:
                                                release_containers.append(parent)
                                                logger.info(f"✅ Найден родительский DIV для элемента")
                                        except:
                                            continue
                                break
                        except Exception as e:
                            logger.debug(f"⚠️ Ошибка поиска по паттерну '{pattern}': {e}")
                            continue
                except Exception as e:
                    logger.error(f"❌ Ошибка поиска по текстовым паттернам: {e}")
            
            if not release_containers:
                logger.error("❌ Контейнеры с релизами не найдены")
                
                # Последняя попытка - ищем все элементы с текстом
                logger.info("🔍 Последняя попытка - поиск всех элементов с текстом...")
                all_elements = self.driver.find_elements(By.XPATH, "//*[text()]")
                logger.info(f"🔍 Всего найдено элементов с текстом: {len(all_elements)}")
                
                # Показываем первые 20 элементов с их текстом
                for i, elem in enumerate(all_elements[:20]):
                    try:
                        text = elem.text.strip()
                        if text and len(text) > 3:
                            tag_name = elem.tag_name
                            class_attr = elem.get_attribute('class')
                            logger.info(f"  Элемент #{i+1}: <{tag_name}> class='{class_attr}' text='{text[:50]}...'")
                    except:
                        pass
                
                return None
            
            logger.info(f"📊 Всего найдено релизов: {len(release_containers)}")
            
            # Анализируем первые 3 релиза для определения структуры
            for i, release in enumerate(release_containers[:3]):
                logger.info(f"\n🔍 Анализ релиза #{i+1}...")
                try:
                    release_html = release.get_attribute('outerHTML')
                    with open(f'zvonko_release_{i+1}.html', 'w', encoding='utf-8') as f:
                        f.write(release_html)
                    logger.info(f"📄 HTML релиза #{i+1} сохранен")
                    
                    # Извлекаем данные
                    data = self.extract_release_data(release, i+1)
                    if data:
                        logger.info(f"✅ Данные релиза #{i+1} извлечены: {list(data.keys())}")
                    else:
                        logger.warning(f"⚠️ Не удалось извлечь данные из релиза #{i+1}")
                except Exception as e:
                    logger.error(f"❌ Ошибка анализа релиза #{i+1}: {e}")
                    logger.error(f"📋 Traceback: {traceback.format_exc()}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка анализа страницы: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return None
    
    def extract_release_data(self, release_element, release_num=1):
        """Извлекает данные из элемента релиза (div.css-1xgpa60)"""
        logger.info(f"🔍 Извлечение данных из релиза #{release_num}...")
        try:
            # Получаем весь текст элемента для анализа
            full_text = release_element.text.strip()
            logger.info(f"📝 Текст релиза: {full_text[:200]}...")
            
            found_data = {}
            
            # Метод 1: Поиск по дочерним элементам внутри div.css-1xgpa60
            # Ищем все дочерние элементы с текстом
            try:
                child_elements = release_element.find_elements(By.XPATH, ".//*")
                logger.info(f"📊 Найдено дочерних элементов: {len(child_elements)}")
                
                # Анализируем каждый дочерний элемент
                for i, elem in enumerate(child_elements):
                    try:
                        elem_text = elem.text.strip()
                        if not elem_text or len(elem_text) < 2:
                            continue
                            
                        tag_name = elem.tag_name
                        class_attr = elem.get_attribute('class') or ''
                        
                        logger.debug(f"  Элемент #{i+1}: <{tag_name}> class='{class_attr}' text='{elem_text[:50]}...'")
                        
                        # Ищем конкретные поля по текстовым паттернам
                        if any(word in elem_text for word in ['GOLD TIME', 'Stfu', 'BRXVKDXWN', 'Burnout Is My Truth', 'SHREDDER', 'UNIVERSE IN MY HEART', 'CROWS', 'Танец души', 'Ты не знаешь', 'Witchery', 'Massacre', 'Амнезия', 'GO KRUSH', 'Sunrise', 'Hypnosis', 'Хочу её', 'Blue Winte', 'BEBE', 'YUREY', 'CHAINSAW', 'SOMEDAY', 'Gold&Silver', 'Like You', 'Low Vibration', 'Street Walk']):
                            if not found_data.get('title'):
                                found_data['title'] = elem_text
                                logger.info(f"✅ title: {elem_text}")
                        
                        elif 'ripznxx' in elem_text or (len(elem_text.split()) == 1 and len(elem_text) > 2 and elem_text.isalpha() and elem_text.islower()):
                            if not found_data.get('artist'):
                                found_data['artist'] = elem_text
                                logger.info(f"✅ artist: {elem_text}")
                        
                        elif re.match(r'^\d{12,14}$', elem_text):
                            if not found_data.get('upc'):
                                found_data['upc'] = elem_text
                                logger.info(f"✅ upc: {elem_text}")
                        
                        elif 'ROSSEL' in elem_text or 'ROSS' in elem_text:
                            if not found_data.get('label'):
                                found_data['label'] = elem_text
                                logger.info(f"✅ label: {elem_text}")
                        
                        elif re.match(r'^\d{4}-\d{2}-\d{2}$', elem_text):
                            if not found_data.get('date'):
                                found_data['date'] = elem_text
                                logger.info(f"✅ date: {elem_text}")
                        
                        elif 'Hip Hop' in elem_text or 'Rap' in elem_text or 'Pop' in elem_text or 'Rock' in elem_text:
                            if not found_data.get('genre'):
                                found_data['genre'] = elem_text
                                logger.info(f"✅ genre: {elem_text}")
                        
                        elif 'Все страны' in elem_text or 'Worldwide' in elem_text:
                            if not found_data.get('territories'):
                                found_data['territories'] = elem_text
                                logger.info(f"✅ territories: {elem_text}")
                        
                        elif elem_text.isdigit() and int(elem_text) > 10 and int(elem_text) < 1000:
                            if not found_data.get('platforms'):
                                found_data['platforms'] = elem_text
                                logger.info(f"✅ platforms: {elem_text}")
                        
                        # Ищем обложки
                        elif tag_name == 'img':
                            src = elem.get_attribute('src')
                            if src and ('http' in src or 'data:' in src):
                                if not found_data.get('cover'):
                                    found_data['cover'] = src
                                    logger.info(f"✅ cover: {src}")
                        
                    except Exception as e:
                        logger.debug(f"⚠️ Ошибка обработки элемента #{i+1}: {e}")
                        continue
                        
            except Exception as e:
                logger.debug(f"⚠️ Ошибка поиска дочерних элементов: {e}")
            
            # Метод 2: Поиск по парам "ключ-значение" (если структура такая)
            try:
                # Ищем элементы с текстом меток (UPC, Лейбл, Дата и т.д.)
                label_patterns = ['UPC', 'Лейбл', 'Дата создания', 'Дата релиза', 'Дата старта', 'Территории', 'Площадки', 'Жанр']
                
                for pattern in label_patterns:
                    try:
                        # Ищем элемент с текстом метки
                        label_elem = release_element.find_element(By.XPATH, f".//*[contains(text(), '{pattern}')]")
                        # Ищем следующий элемент со значением
                        following = label_elem.find_elements(By.XPATH, "./following-sibling::*")
                        if following:
                            value = following[0].text.strip()
                            if value:
                                key = pattern.lower().replace(' ', '_')
                                found_data[key] = value
                                logger.info(f"✅ {key}: {value}")
                    except:
                        continue
            except Exception as e:
                logger.debug(f"⚠️ Ошибка поиска пар ключ-значение: {e}")
            
            # Метод 3: Резервный поиск по всему тексту с regex
            if not found_data.get('title'):
                title_patterns = [
                    r'(GOLD TIME|Stfu|BRXVKDXWN|Burnout Is My Truth|SHREDDER|UNIVERSE IN MY HEART|CROWS|Танец души|Ты не знаешь|Witchery|Massacre|Амнезия|GO KRUSH|Sunrise|Hypnosis|Хочу её|Blue Winte|BEBE|YUREY|CHAINSAW|SOMEDAY|Gold&Silver|Like You|Low Vibration|Street Walk)',
                ]
                for pattern in title_patterns:
                    match = re.search(pattern, full_text)
                    if match:
                        found_data['title'] = match.group(1)
                        logger.info(f"✅ title (regex): {found_data['title']}")
                        break
            
            if not found_data.get('upc'):
                upc_match = re.search(r'\d{12,14}', full_text)
                if upc_match:
                    found_data['upc'] = upc_match.group(0)
                    logger.info(f"✅ upc (regex): {found_data['upc']}")
            
            # Сохраняем найденные данные
            filename = f'zvonko_release_{release_num}_data.json'
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(found_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"📄 Данные релиза #{release_num} сохранены в {filename}")
            logger.info(f"📊 Найдено полей: {list(found_data.keys())}")
            
            return found_data
            
        except Exception as e:
            logger.error(f"❌ Ошибка извлечения данных из релиза #{release_num}: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return None
    
    def run_analysis(self):
        """Запускает полный анализ"""
        logger.info("🚀 Запуск анализа Zvonko...")
        
        try:
            if not self.setup_driver():
                logger.error("❌ Не удалось настроить WebDriver")
                return False
            
            if not self.login_to_zvonko():
                logger.error("❌ Не удалось авторизоваться на Zvonko")
                return False
            
            if not self.analyze_releases_page():
                logger.error("❌ Не удалось проанализировать страницу релизов")
                return False
            
            logger.info("✅ Анализ завершен успешно!")
            logger.info("\n📄 Созданные файлы:")
            logger.info("  - zvonko_login_page.html")
            logger.info("  - zvonko_releases_page.html") 
            logger.info("  - zvonko_release_1.html")
            logger.info("  - zvonko_release_2.html")
            logger.info("  - zvonko_release_3.html")
            logger.info("  - zvonko_release_1_data.json")
            logger.info("  - zvonko_release_2_data.json")
            logger.info("  - zvonko_release_3_data.json")
            logger.info("  - zvonko_analyzer.log")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка при выполнении анализа: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
        finally:
            if self.driver:
                try:
                    self.driver.quit()
                    logger.info("🔚 WebDriver закрыт")
                except Exception as e:
                    logger.error(f"❌ Ошибка при закрытии WebDriver: {e}")

if __name__ == "__main__":
    analyzer = ZvonkoAnalyzer()
    success = analyzer.run_analysis()
    
    if success:
        logger.info("🎉 Анализ успешно завершен!")
        print("\n🎉 Анализ успешно завершен!")
        print("📄 Проверьте созданные файлы для изучения структуры страницы.")
    else:
        logger.error("💥 Анализ завершился с ошибками!")
        print("\n💥 Анализ завершился с ошибками!")
        print("📄 Проверьте файл zvonko_analyzer.log для детальной информации.")
