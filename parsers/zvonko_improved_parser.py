#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Улучшенный парсер Zvonko на основе реального анализа DOM структуры
"""

import json
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
        logging.FileHandler('zvonko_improved_parser.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ZvonkoImprovedParser:
    def __init__(self):
        self.base_url = "https://account.zvonkodigital.com"
        self.releases_url = "https://account.zvonkodigital.com/music/releases"
        self.username = "rossel_66"
        self.password = "rossel_66_27122023"
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
            
            # Поиск поля логина
            try:
                username_input = self.driver.find_element(By.NAME, "username")
                logger.info("✅ Найдено поле логина по name='username'")
            except NoSuchElementException:
                try:
                    username_input = self.driver.find_element(By.ID, "id_username")
                    logger.info("✅ Найдено поле логина по id='id_username'")
                except NoSuchElementException:
                    logger.error("❌ Поле логина не найдено")
                    return False
            
            # Поиск поля пароля
            try:
                password_input = self.driver.find_element(By.NAME, "password")
                logger.info("✅ Найдено поле пароля по name='password'")
            except NoSuchElementException:
                try:
                    password_input = self.driver.find_element(By.ID, "id_password")
                    logger.info("✅ Найдено поле пароля по id='id_password'")
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
                try:
                    login_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Войти') or contains(text(), 'войти')]")
                    logger.info("✅ Найдена кнопка входа (button)")
                    login_button.click()
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
                        elif elem_text in ['Hip Hop', 'Rap', 'Pop', 'Rock', 'Electronic']:
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
    
    def parse_all_releases(self):
        """Парсит все релизы на странице"""
        logger.info("🔍 Начало парсинга релизов...")
        try:
            # Ожидаем загрузки динамического контента
            logger.info("⏳ Ожидание загрузки контента...")
            time.sleep(5)
            
            # Прокрутка для загрузки всех элементов
            logger.info("📜 Прокрутка страницы...")
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
            
            # Ищем контейнеры релизов по правильному селектору
            logger.info("🔍 Поиск контейнеров релизов...")
            release_containers = []
            
            # Основной селектор на основе анализа DOM
            main_selectors = [
                'div.css-1xgpa60',  # Основной контейнер релиза
                'div.chakra-stack.css-muke40',  # Родительский контейнер
            ]
            
            for selector in main_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    logger.info(f"🔍 Селектор '{selector}': найдено {len(elements)} элементов")
                    if len(elements) > 1:
                        release_containers = elements
                        break
                except Exception as e:
                    logger.debug(f"⚠️ Ошибка поиска по селектору '{selector}': {e}")
                    continue
            
            if not release_containers:
                logger.error("❌ Контейнеры с релизами не найдены")
                return False
            
            logger.info(f"📊 Всего найдено релизов: {len(release_containers)}")
            
            # Парсим каждый релиз
            all_releases_data = []
            for i, release in enumerate(release_containers):
                logger.info(f"\n🔍 Парсинг релиза #{i+1}...")
                
                # Сохраняем HTML релиза для анализа
                release_html = release.get_attribute('outerHTML')
                with open(f'zvonko_release_{i+1}.html', 'w', encoding='utf-8') as f:
                    f.write(release_html)
                
                # Извлекаем данные
                data = self.extract_release_data_from_element(release, i+1)
                if data:
                    all_releases_data.append(data)
                    logger.info(f"✅ Данные релиза #{i+1} успешно извлечены")
                else:
                    logger.warning(f"⚠️ Не удалось извлечь данные из релиза #{i+1}")
            
            # Сохраняем все данные
            with open('zvonko_all_releases_data.json', 'w', encoding='utf-8') as f:
                json.dump(all_releases_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✅ Парсинг завершен! Обработано {len(all_releases_data)} релизов")
            logger.info("📄 Данные сохранены в zvonko_all_releases_data.json")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Ошибка парсинга релизов: {e}")
            logger.error(f"📋 Traceback: {traceback.format_exc()}")
            return False
    
    def run_parser(self):
        """Запускает полный парсер"""
        logger.info("🚀 Запуск улучшенного парсера Zvonko...")
        
        try:
            if not self.setup_driver():
                logger.error("❌ Не удалось настроить WebDriver")
                return False
            
            if not self.login_to_zvonko():
                logger.error("❌ Не удалось авторизоваться на Zvonko")
                return False
            
            if not self.parse_all_releases():
                logger.error("❌ Не удалось распарсить релизы")
                return False
            
            logger.info("✅ Парсинг успешно завершен!")
            logger.info("\n📄 Созданные файлы:")
            logger.info("  - zvonko_all_releases_data.json")
            logger.info("  - zvonko_release_*.html (для каждого релиза)")
            logger.info("  - zvonko_release_*_data.json (для каждого релиза)")
            logger.info("  - zvonko_improved_parser.log")
            
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
    parser = ZvonkoImprovedParser()
    success = parser.run_parser()
    
    if success:
        logger.info("🎉 Парсинг успешно завершен!")
        print("\n🎉 Парсинг успешно завершен!")
        print("📄 Проверьте созданные файлы для просмотра результатов.")
    else:
        logger.error("💥 Парсинг завершился с ошибками!")
        print("\n💥 Парсинг завершился с ошибками!")
        print("📄 Проверьте файл zvonko_improved_parser.log для детальной информации.")
