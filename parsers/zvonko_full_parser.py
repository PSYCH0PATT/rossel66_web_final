#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Полный парсер Zvonko с поддержкой пагинации
"""

import json
import os
import time
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
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('zvonko_full_parser.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ZvonkoFullParser:
    def __init__(self):
        self.base_url = "https://account.zvonkodigital.com"
        self.releases_url = "https://account.zvonkodigital.com/music/releases"
        self.username = (os.environ.get("ZVONKO_USERNAME") or "").strip()
        if not self.username:
            raise ValueError("ZVONKO_USERNAME environment variable is required")
        self.password = os.environ.get("ZVONKO_PASSWORD")
        if not self.password:
            raise ValueError("Задайте переменную окружения ZVONKO_PASSWORD")
        self.driver = None
    
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
            
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Ищем поля входа
            username_input = None
            password_input = None
            
            try:
                username_input = self.driver.find_element(By.NAME, "username")
                logger.info("✅ Найдено поле логина по name='username'")
            except NoSuchElementException:
                logger.error("❌ Поле логина не найдено")
                return False
            
            try:
                password_input = self.driver.find_element(By.NAME, "password")
                logger.info("✅ Найдено поле пароля по name='password'")
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
                logger.info("✅ Найдена кнопка входа (input submit)")
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
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
    
    def extract_release_data_from_element(self, release_element, release_num=1):
        """Извлекает данные из элемента релиза (div.css-1xgpa60)"""
        logger.info(f"🔍 Извлечение данных из релиза #{release_num}...")
        try:
            found_data = {}
            
            # Получаем весь текст элемента
            full_text = release_element.text.strip()
            logger.info(f"📝 Текст релиза: {full_text[:200]}...")
            
            # Метод 1: Поиск по дочерним элементам с конкретными селекторами
            try:
                # Ищем название и исполнителя
                title_elements = release_element.find_elements(By.CSS_SELECTOR, "p.chakra-text.css-106kqq8")
                artist_elements = release_element.find_elements(By.CSS_SELECTOR, "p.chakra-text.css-uvztd0")
                
                if title_elements:
                    found_data['title'] = title_elements[0].text.strip()
                    logger.info(f"✅ title: {found_data['title']}")
                
                if artist_elements:
                    found_data['artist'] = artist_elements[0].text.strip()
                    logger.info(f"✅ artist: {found_data['artist']}")
                
                # Ищем обложку
                img_elements = release_element.find_elements(By.CSS_SELECTOR, "img.chakra-image.css-1phd9a0")
                if img_elements:
                    img_src = img_elements[0].get_attribute('src')
                    if img_src:
                        found_data['cover'] = img_src
                        logger.info(f"✅ cover: {img_src}")
                
                # Ищем все текстовые элементы для извлечения других данных
                text_elements = release_element.find_elements(By.XPATH, ".//*[text()]")
                for elem in text_elements:
                    try:
                        elem_text = elem.text.strip()
                        if not elem_text or len(elem_text) < 2:
                            continue
                        
                        # Ищем UPC
                        if re.match(r'^\d{12,14}$', elem_text):
                            if not found_data.get('upc'):
                                found_data['upc'] = elem_text
                                logger.info(f"✅ upc: {elem_text}")
                        
                        # Ищем даты
                        elif re.match(r'^\d{4}-\d{2}-\d{2}$', elem_text):
                            if not found_data.get('date'):
                                found_data['date'] = elem_text
                                logger.info(f"✅ date: {elem_text}")
                        
                        # Ищем лейбл
                        elif 'ROSSEL' in elem_text:
                            if not found_data.get('label'):
                                found_data['label'] = elem_text
                                logger.info(f"✅ label: {elem_text}")
                        
                        # Ищем жанр
                        elif elem_text in ['Hip Hop', 'Rap', 'Pop', 'Rock', 'Electronic', 'Hip Hop/Rap', 'Phonk/Fonk']:
                            if not found_data.get('genre'):
                                found_data['genre'] = elem_text
                                logger.info(f"✅ genre: {elem_text}")
                        
                        # Ищем территории
                        elif 'Все страны' in elem_text or 'Worldwide' in elem_text:
                            if not found_data.get('territories'):
                                found_data['territories'] = elem_text
                                logger.info(f"✅ territories: {elem_text}")
                        
                        # Ищем количество площадок
                        elif elem_text.isdigit() and int(elem_text) > 10 and int(elem_text) < 1000:
                            if not found_data.get('platforms'):
                                found_data['platforms'] = elem_text
                                logger.info(f"✅ platforms: {elem_text}")
                    
                    except Exception as e:
                        logger.debug(f"⚠️ Ошибка обработки текстового элемента: {e}")
                        continue
                        
            except Exception as e:
                logger.debug(f"⚠️ Ошибка поиска по селекторам: {e}")
            
            # Метод 2: Поиск по всему тексту с regex (backup)
            if not found_data.get('title'):
                title_patterns = [
                    r'(GOLD TIME|Stfu|BRXVKDXWN|Burnout Is My Truth|SHREDDER|UNIVERSE IN MY HEART|CROWS|Танец души|Ты не знаешь|Witchery|Massacre|Амнезия|GO KRUSH|Sunrise|Hypnosis|Хочу её|Blue Winte|BEBE|YUREY|CHAINSAW|SOMEDAY|Gold&Silver|Like You|Low Vibration|Street Walk|BANDO|Как тебе идея|Стало холодно|War|FERVENT KID|In the Dark|Dissonance|LE GASX|WWW)',
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
            
            return found_data
            
        except Exception as e:
            logger.error(f"❌ Ошибка извлечения данных из релиза #{release_num}: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return None
    
    def parse_current_page(self, page_num=1):
        """Парсит релизы на текущей странице"""
        logger.info(f"🔍 Парсинг страницы #{page_num}...")
        try:
            # Ожидаем загрузки контента
            time.sleep(3)
            
            # Прокрутка для загрузки всех элементов
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
            
            # Ищем контейнеры релизов
            release_containers = []
            
            main_selectors = [
                'div.css-1xgpa60',  # Основной контейнер релиза
                'div.chakra-stack.css-muke40',  # Родительский контейнер
            ]
            
            for selector in main_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if len(elements) > 1:
                        release_containers = elements
                        logger.info(f"📊 На странице #{page_num} найдено {len(elements)} релизов по селектору: {selector}")
                        break
                except Exception as e:
                    continue
            
            if not release_containers:
                logger.warning(f"⚠️ На странице #{page_num} контейнеры с релизами не найдены")
                return []
            
            # Парсим каждый релиз на странице
            page_releases = []
            for i, release in enumerate(release_containers):
                release_global_num = (page_num - 1) * len(release_containers) + i + 1
                logger.info(f"\n🔍 Парсинг релиза #{release_global_num} (страница #{page_num}, позиция #{i+1})...")
                
                # Сохраняем HTML релиза для анализа
                release_html = release.get_attribute('outerHTML')
                with open(f'zvonko_release_{release_global_num}.html', 'w', encoding='utf-8') as f:
                    f.write(release_html)
                
                # Извлекаем данные
                data = self.extract_release_data_from_element(release, release_global_num)
                if data:
                    data['page'] = page_num
                    data['position_on_page'] = i + 1
                    page_releases.append(data)
                    
                    # Сохраняем данные релиза
                    filename = f'zvonko_release_{release_global_num}_data.json'
                    with open(filename, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                    logger.info(f"✅ Данные релиза #{release_global_num} успешно извлечены")
                else:
                    logger.warning(f"⚠️ Не удалось извлечь данные из релиза #{release_global_num}")
            
            logger.info(f"✅ Страница #{page_num} завершена! Обработано {len(page_releases)} релизов")
            return page_releases
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга страницы #{page_num}: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return []
    
    def parse_all_pages(self, max_pages=None):
        """Парсит все страницы с релизами (от последней к первой)"""
        logger.info("🔍 Начало парсинга всех страниц...")
        
        all_releases = []
        current_page = 1
        
        try:
            # Парсим страницы, пока есть кнопка "предыдущая" или не достигнут лимит
            while True:
                # Проверяем лимит страниц
                if max_pages and current_page > max_pages:
                    logger.info(f"🛑 Достигнут лимит страниц ({max_pages})")
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
                        logger.info("✅ Достигнута первая страница, парсинг завершен")
                        break
                    
                    # Нажимаем кнопку "предыдущая"
                    logger.info("🖱️ Переход к предыдущей странице...")
                    prev_button.click()
                    time.sleep(3)  # Ожидание загрузки
                    
                    current_page += 1
                    
                except NoSuchElementException:
                    logger.info("✅ Кнопка 'предыдущая' не найдена, парсинг завершен")
                    break
                except Exception as e:
                    logger.error(f"❌ Ошибка при переходе к предыдущей странице: {e}")
                    break
            
            logger.info(f"✅ Парсинг всех страниц завершен! Всего обработано {len(all_releases)} релизов с {current_page-1} страниц")
            
            # Сохраняем все данные
            with open('zvonko_all_releases_full.json', 'w', encoding='utf-8') as f:
                json.dump(all_releases, f, ensure_ascii=False, indent=2)
            
            logger.info("📄 Все данные сохранены в zvonko_all_releases_full.json")
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка при парсинге всех страниц: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
    
    def run_parser(self, max_pages=None):
        """Запускает полный парсер"""
        logger.info("🚀 Запуск полного парсера Zvonko с пагинацией...")
        
        try:
            if not self.setup_driver():
                logger.error("❌ Не удалось настроить WebDriver")
                return False
            
            if not self.login_to_zvonko():
                logger.error("❌ Не удалось авторизоваться на Zvonko")
                return False
            
            if not self.parse_all_pages(max_pages):
                logger.error("❌ Не удалось распарсить все релизы")
                return False
            
            logger.info("✅ Полный парсинг успешно завершен!")
            logger.info("\n📄 Созданные файлы:")
            logger.info("  - zvonko_all_releases_full.json (все релизы со всех страниц)")
            logger.info("  - zvonko_release_*.html (HTML каждого релиза)")
            logger.info("  - zvonko_release_*_data.json (данные каждого релиза)")
            logger.info("  - zvonko_full_parser.log")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Критическая ошибка при выполнении парсера: {e}")
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
    import sys
    
    # Проверяем аргументы командной строки
    max_pages = None
    if len(sys.argv) > 1:
        try:
            max_pages = int(sys.argv[1])
            logger.info(f"📊 Установлен лимит страниц: {max_pages}")
        except ValueError:
            logger.warning("⚠️ Неверный формат лимита страниц, используется значение по умолчанию")
    
    parser = ZvonkoFullParser()
    success = parser.run_parser(max_pages)
    
    if success:
        logger.info("🎉 Полный парсинг успешно завершен!")
        print("\n🎉 Полный парсинг успешно завершен!")
        print("📄 Проверьте созданные файлы для просмотра результатов.")
    else:
        logger.error("💥 Парсинг завершился с ошибками!")
        print("\n💥 Парсинг завершился с ошибками!")
        print("📄 Проверьте файл zvonko_full_parser.log для детальной информации.")
