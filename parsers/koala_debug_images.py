#!/usr/bin/env python3
"""
Отладочный скрипт для поиска изображений на странице релиза Koala
"""

import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def debug_release_page():
    """Анализирует страницу релиза и показывает все изображения"""
    
    # Настройка Chrome
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Авторизация
        print("🔐 Авторизация...")
        driver.get("https://portal.koala-music.com")
        
        # Заполняем форму
        username = driver.find_element(By.NAME, "username")
        password = driver.find_element(By.NAME, "password")
        
        username.clear()
        username.send_keys("Maks.lat@bk.ru")
        
        password.clear()
        password.send_keys("IXLth1gU5v")
        
        # Нажимаем вход
        submit = driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
        submit.submit()
        
        # Ожидаем загрузки
        time.sleep(5)
        
        # Переходим на страницу конкретного релиза
        release_url = "https://portal.koala-music.com/releases/44963"  # stars - PLVT
        print(f"🔍 Анализ страницы: {release_url}")
        driver.get(release_url)
        time.sleep(5)
        
        # Получаем все изображения
        print("\n📸 ВСЕ ИЗОБРАЖЕНИЯ НА СТРАНИЦЕ:")
        print("=" * 60)
        
        all_images = driver.find_elements(By.TAG_NAME, "img")
        
        for i, img in enumerate(all_images):
            try:
                src = img.get_attribute('src') or "NO_SRC"
                alt = img.get_attribute('alt') or "NO_ALT"
                class_name = img.get_attribute('class') or "NO_CLASS"
                width = img.get_attribute('width') or "NO_WIDTH"
                height = img.get_attribute('height') or "NO_HEIGHT"
                
                print(f"\n🖼️ Изображение #{i+1}:")
                print(f"   SRC: {src[:100]}..." if len(src) > 100 else f"   SRC: {src}")
                print(f"   ALT: {alt}")
                print(f"   CLASS: {class_name}")
                print(f"   SIZE: {width}x{height}")
                
                # Проверяем, является ли обложкой
                if any(keyword in alt.lower() for keyword in ['cover', 'обложка', 'artwork']):
                    print("   🎯 ПОХОЖЕ НА ОБЛОЖКУ!")
                
                if any(keyword in class_name.lower() for keyword in ['cover', 'artwork', 'image']):
                    print("   🎯 КЛАСС УКАЗЫВАЕТ НА ОБЛОЖКУ!")
                    
                if src.startswith('blob:'):
                    print("   🔄 BLOB URL - НУЖНА КОНВЕРТАЦИЯ!")
                    
            except Exception as e:
                print(f"❌ Ошибка анализа изображения #{i+1}: {e}")
        
        # Ищем по конкретным селекторам
        print("\n🎯 ПОИСК ПО КОНКРЕТНЫМ СЕЛЕКТОРАМ:")
        print("=" * 60)
        
        selectors = [
            'img[alt*="cover"]',
            'img[alt*="Cover"]', 
            'img[alt*="обложка"]',
            '.cover img',
            '.release-cover img',
            '.artwork img',
            'img[src*="blob"]',
            'aside img',
            'main img',
            '.chakra-image img',
            'img[class*="cover"]',
            'img[class*="artwork"]'
        ]
        
        for selector in selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"\n✅ Селектор '{selector}' найден: {len(elements)} элементов")
                    for j, elem in enumerate(elements):
                        src = elem.get_attribute('src') or "NO_SRC"
                        alt = elem.get_attribute('alt') or "NO_ALT"
                        print(f"   Элемент #{j+1}: SRC={src[:50]}... ALT={alt}")
                else:
                    print(f"❌ Селектор '{selector}' - ничего не найдено")
            except Exception as e:
                print(f"❌ Ошибка селектора '{selector}': {e}")
        
        # Пробуем конвертировать blob если найден
        blob_images = driver.find_elements(By.CSS_SELECTOR, 'img[src*="blob"]')
        if blob_images:
            print(f"\n🔄 НАЙДЕНО BLOB ИЗОБРАЖЕНИЙ: {len(blob_images)}")
            for i, blob_img in enumerate(blob_images):
                try:
                    src = blob_img.get_attribute('src')
                    print(f"BLOB #{i+1}: {src}")
                    
                    # Пробуем конвертировать
                    data_url = driver.execute_script("""
                        var img = arguments[0];
                        try {
                            var canvas = document.createElement('canvas');
                            var ctx = canvas.getContext('2d');
                            canvas.width = img.naturalWidth || 100;
                            canvas.height = img.naturalHeight || 100;
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
                    """, blob_img)
                    
                    if data_url['success']:
                        print(f"✅ КОНВЕРТАЦИЯ УСПЕШНА: {data_url['width']}x{data_url['height']}")
                        print(f"   Data URL length: {len(data_url['dataURL'])}")
                    else:
                        print(f"❌ Ошибка конвертации: {data_url['error']}")
                        
                except Exception as e:
                    print(f"❌ Ошибка обработки blob #{i+1}: {e}")
        
    finally:
        driver.quit()
        print("\n🔚 Браузер закрыт")

if __name__ == "__main__":
    debug_release_page()
