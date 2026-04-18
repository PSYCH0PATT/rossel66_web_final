#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой анализатор DOM для ручного анализа структуры Zvonko
"""

import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def main():
    print("🚀 Запуск простого анализатора DOM...")
    
    # Настройка Chrome
    chrome_options = Options()
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--start-maximized')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # 1. Переход на страницу входа
        print("📍 Переход на страницу входа...")
        driver.get("https://account.zvonkodigital.com")
        
        # Ожидание загрузки
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        
        # Сохраняем страницу входа
        with open('zvonko_login_analysis.html', 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        print("📄 Страница входа сохранена")
        
        # 2. Поиск полей входа
        print("🔍 Поиск полей входа...")
        
        # Ищем все input элементы
        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"📊 Найдено input элементов: {len(inputs)}")
        
        for i, inp in enumerate(inputs):
            try:
                input_type = inp.get_attribute('type')
                input_name = inp.get_attribute('name')
                input_placeholder = inp.get_attribute('placeholder')
                input_id = inp.get_attribute('id')
                print(f"  Input #{i+1}: type={input_type}, name={input_name}, placeholder={input_placeholder}, id={input_id}")
            except:
                pass
        
        # 3. Вход в систему
        login_input = None
        password_input = None
        
        for inp in inputs:
            try:
                input_type = inp.get_attribute('type')
                input_placeholder = inp.get_attribute('placeholder') or ''
                input_name = inp.get_attribute('name') or ''
                
                if input_type == 'text' or 'username' in input_name.lower() or 'login' in input_placeholder.lower() or 'email' in input_placeholder.lower():
                    login_input = inp
                    print(f"✅ Найдено поле логина: type={input_type}, name={input_name}, placeholder={input_placeholder}")
                    break
            except:
                continue
        
        for inp in inputs:
            try:
                input_type = inp.get_attribute('type')
                if input_type == 'password':
                    password_input = inp
                    print(f"✅ Найдено поле пароля")
                    break
            except:
                continue
        
        if login_input and password_input:
            print("⌨️ Ввод данных...")
            login_input.clear()
            login_input.send_keys(zuser)
            
            password_input.clear()
            password_input.send_keys(zpwd)
            
            # Ищем кнопку входа или input submit
            submit_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='submit']")
            buttons = driver.find_elements(By.TAG_NAME, "button")
            
            login_element = None
            
            # Сначала пробуем input submit
            if submit_inputs:
                login_element = submit_inputs[0]
                print(f"✅ Найден input submit")
            # Потом кнопки
            elif buttons:
                for btn in buttons:
                    try:
                        btn_text = btn.text.strip()
                        if 'войти' in btn_text.lower() or btn_text == '':
                            login_element = btn
                            print(f"✅ Найдена кнопка входа: '{btn_text}'")
                            break
                    except:
                        continue
            
            if login_element:
                print("🖱️ Нажатие кнопки входа...")
                login_element.submit()  # Используем submit вместо click
                time.sleep(5)
                
                # 4. Переход на страницу релизов
                print("🎵 Переход на страницу релизов...")
                driver.get("https://account.zvonkodigital.com/music/releases")
                
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "body"))
                )
                
                time.sleep(5)
                
                # Сохраняем страницу релизов
                with open('zvonko_releases_analysis.html', 'w', encoding='utf-8') as f:
                    f.write(driver.page_source)
                print("📄 Страница релизов сохранена")
                
                # 5. Анализ DOM структуры
                print("🔍 Анализ DOM структуры...")
                
                # Ищем все div элементы с классами
                divs = driver.find_elements(By.TAG_NAME, "div")
                print(f"📊 Всего найдено div элементов: {len(divs)}")
                
                # Ищем элементы с классами содержащими "css-"
                css_divs = []
                for div in divs:
                    try:
                        class_attr = div.get_attribute('class') or ''
                        if 'css-' in class_attr:
                            css_divs.append({
                                'class': class_attr,
                                'text': div.text.strip()[:100],
                                'html': div.get_attribute('outerHTML')[:200]
                            })
                    except:
                        continue
                
                print(f"📊 Найдено div с css- классами: {len(css_divs)}")
                
                # Сохраняем анализ
                with open('zvonko_dom_analysis.json', 'w', encoding='utf-8') as f:
                    json.dump(css_divs, f, ensure_ascii=False, indent=2)
                
                print("📄 DOM анализ сохранен в zvonko_dom_analysis.json")
                
                # Показываем первые 10 элементов
                for i, div_data in enumerate(css_divs[:10]):
                    print(f"  Div #{i+1}: class='{div_data['class']}' text='{div_data['text']}...'")
                
                print("\n✅ Анализ завершен!")
                print("📄 Проверьте файлы:")
                print("  - zvonko_login_analysis.html")
                print("  - zvonko_releases_analysis.html")
                print("  - zvonko_dom_analysis.json")
                
            else:
                print("❌ Кнопка входа не найдена")
        else:
            print("❌ Поля входа не найдены")
            
        # Ждем ручного закрытия
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
