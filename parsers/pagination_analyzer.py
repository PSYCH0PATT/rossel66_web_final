#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализатор пагинации Zvonko
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
    print("🔍 Анализ пагинации Zvonko...")
    
    # Настройка Chrome
    chrome_options = Options()
    zuser = os.environ.get("ZVONKO_USERNAME", "").strip()
    if not zuser:
        print("Задайте ZVONKO_USERNAME", file=sys.stderr)
        sys.exit(1)
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
        username_input.send_keys("rossel_66")
        
        password_input.clear()
        password_input.send_keys("rossel_66_27122023")
        
        username_input.send_keys(zuser)
        
        password_input.clear()
        password_input.send_keys(zpwd)
        
        # 2. Переход на страницу релизов
        print("🎵 Переход на страницу релизов...")
        driver.get("https://account.zvonkodigital.com/music/releases")
        
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        time.sleep(5)
        
        # 3. Анализ пагинации
        print("🔍 Анализ элементов пагинации...")
        
        # Ищем все возможные элементы пагинации
        pagination_selectors = [
            'button[aria-label*="page"]',
            'button[aria-label*="Page"]',
            'button[title*="page"]',
            'button[title*="Page"]',
            '.pagination button',
            '[class*="pagination"] button',
            '[class*="page"] button',
            'nav button',
            '[role="navigation"] button',
            'button[class*="next"]',
            'button[class*="prev"]',
            'button[class*="previous"]',
            'a[href*="page"]',
            '[class*="pager"] button',
            '[class*="paging"] button'
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
        
        # Ищем стрелки/кнопки навигации
        print("\n🔍 Поиск кнопок навигации...")
        nav_buttons = []
        
        for btn in all_buttons:
            try:
                text = btn.text.strip()
                class_attr = btn.get_attribute('class') or ''
                aria_label = btn.get_attribute('aria-label') or ''
                
                # Ищем кнопки со стрелками или словами навигации
                if (any(word in text.lower() for word in ['next', 'prev', 'previous', 'след', 'пред', '→', '←', '>', '<']) or
                    any(word in aria_label.lower() for word in ['next', 'prev', 'previous', 'след', 'пред']) or
                    any(word in class_attr.lower() for word in ['next', 'prev', 'previous', 'arrow', 'nav'])):
                    
                    nav_buttons.append(btn)
                    disabled = btn.get_attribute('disabled') is not None
                    print(f"  Кнопка навигации: text='{text}' aria-label='{aria_label}' class='{class_attr}' disabled={disabled}")
            except:
                continue
        
        # Сохраняем HTML страницы для детального анализа
        with open('zvonko_pagination_analysis.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        
        print(f"\n📊 Результаты анализа:")
        print(f"  - Найдено элементов пагинации: {len(found_pagination)}")
        print(f"  - Найдено кнопок с номерами страниц: {len(number_buttons)}")
        print(f"  - Найдено кнопок навигации: {len(nav_buttons)}")
        print(f"  - HTML сохранен в zvonko_pagination_analysis.html")
        
        # Пробуем нажать на кнопку "следующая страница" если есть
        if nav_buttons:
            print("\n🖱️ Пробуем нажать на первую кнопку навигации...")
            try:
                nav_buttons[0].click()
                time.sleep(3)
                print("✅ Кнопка нажата, страница обновлена")
                
                # Проверяем изменился ли URL
                current_url = driver.current_url
                print(f"📍 Текущий URL: {current_url}")
                
            except Exception as e:
                print(f"❌ Ошибка при нажатии: {e}")
        
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
