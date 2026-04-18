#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализатор пагинации Zvonko с правильными селекторами
"""

import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def main():
    zpwd = os.environ.get("ZVONKO_PASSWORD")
    if not zpwd:
        print("Задайте ZVONKO_PASSWORD", file=sys.stderr)
        sys.exit(1)
    zuser = os.environ.get("ZVONKO_USERNAME", "").strip()
    if not zuser:
        print("Задайте ZVONKO_USERNAME", file=sys.stderr)
        sys.exit(1)
    print("🔍 Анализ пагинации Zvonko с правильными селекторами...")
    
    # Настройка Chrome
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--start-maximized')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # 1. Авторизация
        print("🔐 Авторизация...")
        driver.get("https://account.zvonkodigital.com")
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Вход
        username_input = driver.find_element(By.NAME, "username")
        password_input = driver.find_element(By.NAME, "password")
        
        username_input.clear()
        username_input.send_keys(zuser)
        
        password_input.clear()
        password_input.send_keys(zpwd)
        
        submit_input = driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
        submit_input.submit()
        
        time.sleep(5)
        
        # 2. Переход на страницу релизов
        print("🎵 Переход на страницу релизов...")
        driver.get("https://account.zvonkodigital.com/music/releases")
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        time.sleep(5)
        
        # 3. Анализ пагинации с правильными селекторами
        print("🔍 Анализ элементов пагинации...")
        
        # Правильные селекторы для пагинации
        pagination_selectors = [
            '.page-previous-button',
            '.page-next-button', 
            '[class*="page-previous-button"]',
            '[class*="page-next-button"]',
            '[class*="page-previous"]',
            '[class*="page-next"]',
            '.pagination button',
            '[class*="pagination"] button',
            'button[aria-label*="previous"]',
            'button[aria-label*="next"]',
            'button[aria-label*="Previous"]',
            'button[aria-label*="Next"]'
        ]
        
        found_pagination = []
        
        for selector in pagination_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"✅ Найдено {len(elements)} элементов по селектору: {selector}")
                    found_pagination.extend(elements)
                    
                    # Показываем детали каждого элемента
                    for i, elem in enumerate(elements):
                        try:
                            text = elem.text.strip()
                            aria_label = elem.get_attribute('aria-label') or ''
                            title = elem.get_attribute('title') or ''
                            class_attr = elem.get_attribute('class') or ''
                            disabled = elem.get_attribute('disabled') is not None
                            
                            print(f"  Элемент #{i+1}: text='{text}' aria-label='{aria_label}' title='{title}' class='{class_attr}' disabled={disabled}")
                        except:
                            continue
            except Exception as e:
                continue
        
        # Ищем элементы с цифрами (страницы)
        print("\n🔍 Поиск элементов с цифрами...")
        all_buttons = driver.find_elements(By.TAG_NAME, "button")
        number_buttons = []
        
        for btn in all_buttons:
            try:
                text = btn.text.strip()
                if text.isdigit() and 1 <= int(text) <= 100:  # Предполагаем номера страниц
                    number_buttons.append(btn)
                    class_attr = btn.get_attribute('class') or ''
                    disabled = btn.get_attribute('disabled') is not None
                    print(f"  Кнопка страницы: '{text}' class='{class_attr}' disabled={disabled}")
            except:
                continue
        
        # Сохраняем HTML страницы для детального анализа
        with open('zvonko_pagination_analysis.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        
        print(f"\n📊 Результаты анализа:")
        print(f"  - Найдено элементов пагинации: {len(found_pagination)}")
        print(f"  - Найдено кнопок с номерами страниц: {len(number_buttons)}")
        print(f"  - HTML сохранен в zvonko_pagination_analysis.html")
        
        # Пробуем найти и проанализировать кнопки навигации
        print("\n🔍 Детальный анализ кнопок навигации...")
        
        try:
            prev_buttons = driver.find_elements(By.CSS_SELECTOR, '.page-previous-button')
            next_buttons = driver.find_elements(By.CSS_SELECTOR, '.page-next-button')
            
            print(f"  - Кнопок 'предыдущая': {len(prev_buttons)}")
            print(f"  - Кнопок 'следующая': {len(next_buttons)}")
            
            if prev_buttons:
                for i, btn in enumerate(prev_buttons):
                    disabled = btn.get_attribute('disabled') is not None
                    print(f"    Кнопка #{i+1}: disabled={disabled}")
            
            if next_buttons:
                for i, btn in enumerate(next_buttons):
                    disabled = btn.get_attribute('disabled') is not None
                    print(f"    Кнопка #{i+1}: disabled={disabled}")
                    
                    # Пробуем нажать на кнопку "следующая"
                    if not disabled and i == 0:
                        print("\n🖱️ Пробуем нажать на кнопку 'следующая'...")
                        try:
                            btn.click()
                            time.sleep(3)
                            print("✅ Кнопка 'следующая' нажата")
                            
                            # Проверяем изменился ли URL
                            current_url = driver.current_url
                            print(f"📍 Текущий URL: {current_url}")
                            
                            # Снова ищем элементы пагинации на новой странице
                            print("\n🔍 Анализ пагинации на новой странице...")
                            new_prev_buttons = driver.find_elements(By.CSS_SELECTOR, '.page-previous-button')
                            new_next_buttons = driver.find_elements(By.CSS_SELECTOR, '.page-next-button')
                            
                            print(f"  - Кнопок 'предыдущая' на новой странице: {len(new_prev_buttons)}")
                            print(f"  - Кнопок 'следующая' на новой странице: {len(new_next_buttons)}")
                            
                            if new_prev_buttons:
                                for btn in new_prev_buttons:
                                    disabled = btn.get_attribute('disabled') is not None
                                    print(f"    Кнопка 'предыдущая': disabled={disabled}")
                            
                        except Exception as e:
                            print(f"❌ Ошибка при нажатии: {e}")
                
        except Exception as e:
            print(f"❌ Ошибка при поиске кнопок навигации: {e}")
        
        print("\n⏳ Браузер открыт для ручного анализа. Нажмите Enter для закрытия...")
        input()
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        driver.quit()
        print("🔚 Браузер закрыт")

if __name__ == "__main__":
    main()
