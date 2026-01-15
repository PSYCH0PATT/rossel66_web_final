#!/usr/bin/env python3
"""
Быстрый тест конвертации blob URL из background-image
"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_blob_conversion():
    """Тестируем конвертацию blob URL из background-image"""
    
    # Настройка Chrome
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Быстрая авторизация
        print("🔐 Авторизация...")
        driver.get("https://portal.koala-music.com")
        
        username = driver.find_element(By.NAME, "username")
        password = driver.find_element(By.NAME, "password")
        
        username.clear()
        username.send_keys("Maks.lat@bk.ru")
        password.clear()
        password.send_keys("IXLth1gU5v")
        
        driver.find_element(By.CSS_SELECTOR, "input[type='submit']").submit()
        time.sleep(5)
        
        # Переходим на страницу релиза
        print("🔍 Переход на страницу релиза...")
        driver.get("https://portal.koala-music.com/releases/44963")
        time.sleep(5)
        
        # Ищем элемент с background-image
        print("🎯 Поиск элемента с background-image...")
        
        # Ищем по стилю background-image
        elements_with_bg = driver.execute_script("""
            var elements = [];
            var all = document.getElementsByTagName('*');
            for (var i = 0; i < all.length; i++) {
                var elem = all[i];
                var style = window.getComputedStyle(elem);
                var bgImage = style.backgroundImage;
                if (bgImage && bgImage.indexOf('blob:') !== -1) {
                    elements.push({
                        element: elem,
                        backgroundImage: bgImage,
                        tagName: elem.tagName,
                        className: elem.className,
                        id: elem.id
                    });
                }
            }
            return elements;
        """)
        
        print(f"📸 Найдено элементов с blob background-image: {len(elements_with_bg)}")
        
        for i, elem_data in enumerate(elements_with_bg):
            print(f"\n🖼️ Элемент #{i+1}:")
            print(f"   Тег: {elem_data['tagName']}")
            print(f"   Класс: {elem_data['className']}")
            print(f"   ID: {elem_data['id']}")
            print(f"   Background: {elem_data['backgroundImage'][:100]}...")
            
            # Пробуем извлечь blob URL
            bg_image = elem_data['backgroundImage']
            if 'blob:' in bg_image:
                # Извлекаем blob URL
                import re
                blob_match = re.search(r'blob:[^"]+', bg_image)
                if blob_match:
                    blob_url = blob_match.group(0)
                    print(f"   🔄 Blob URL: {blob_url}")
                    
                    # Пробуем конвертировать через canvas
                    try:
                        # Создаем img элемент и загружаем blob
                        conversion_result = driver.execute_script("""
                            var blobUrl = arguments[0];
                            var element = arguments[1];
                            
                            return new Promise(function(resolve) {
                                var img = new Image();
                                img.onload = function() {
                                    try {
                                        var canvas = document.createElement('canvas');
                                        var ctx = canvas.getContext('2d');
                                        canvas.width = img.naturalWidth;
                                        canvas.height = img.naturalHeight;
                                        ctx.drawImage(img, 0, 0);
                                        
                                        var dataURL = canvas.toDataURL('image/jpeg', 0.8);
                                        resolve({
                                            success: true,
                                            dataURL: dataURL,
                                            width: img.naturalWidth,
                                            height: img.naturalHeight,
                                            size: dataURL.length
                                        });
                                    } catch(e) {
                                        resolve({
                                            success: false,
                                            error: e.toString()
                                        });
                                    }
                                };
                                img.onerror = function() {
                                    resolve({
                                        success: false,
                                        error: 'Image load error'
                                    });
                                };
                                img.src = blobUrl;
                            });
                        """, blob_url, elem_data['element'])
                        
                        # Ждем результат асинхронной операции
                        time.sleep(3)
                        
                        # Проверяем результат
                        if conversion_result and conversion_result.get('success'):
                            print(f"   ✅ КОНВЕРТАЦИЯ УСПЕШНА!")
                            print(f"   📏 Размер: {conversion_result['width']}x{conversion_result['height']}")
                            print(f"   📦 Data URL размер: {conversion_result['size']} байт")
                            print(f"   🔗 Data URL: {conversion_result['dataURL'][:100]}...")
                        else:
                            print(f"   ❌ Ошибка конвертации: {conversion_result.get('error', 'Unknown error')}")
                            
                    except Exception as e:
                        print(f"   ❌ Ошибка скрипта: {e}")
        
        # Также пробуем прямой метод через элемент
        print("\n🔄 Альтернативный метод через элемент...")
        
        for i, elem_data in enumerate(elements_with_bg[:1]):  # Только первый элемент
            try:
                # Получаем computed style и пробуем создать изображение
                result = driver.execute_script("""
                    var element = arguments[0];
                    var style = window.getComputedStyle(element);
                    var bgImage = style.backgroundImage;
                    
                    // Извлекаем blob URL
                    var blobMatch = bgImage.match(/blob:[^)]+/);
                    if (!blobMatch) {
                        return { success: false, error: 'No blob URL found' };
                    }
                    
                    var blobUrl = blobMatch[0];
                    
                    // Создаем временное изображение
                    var tempImg = document.createElement('img');
                    tempImg.style.position = 'absolute';
                    tempImg.style.left = '-9999px';
                    tempImg.style.top = '-9999px';
                    document.body.appendChild(tempImg);
                    
                    return new Promise(function(resolve) {
                        tempImg.onload = function() {
                            try {
                                var canvas = document.createElement('canvas');
                                var ctx = canvas.getContext('2d');
                                canvas.width = tempImg.naturalWidth;
                                canvas.height = tempImg.naturalHeight;
                                ctx.drawImage(tempImg, 0, 0);
                                
                                var dataURL = canvas.toDataURL('image/jpeg', 0.8);
                                
                                // Удаляем временный элемент
                                document.body.removeChild(tempImg);
                                
                                resolve({
                                    success: true,
                                    dataURL: dataURL,
                                    width: tempImg.naturalWidth,
                                    height: tempImg.naturalHeight
                                });
                            } catch(e) {
                                document.body.removeChild(tempImg);
                                resolve({
                                    success: false,
                                    error: e.toString()
                                });
                            }
                        };
                        
                        tempImg.onerror = function() {
                            document.body.removeChild(tempImg);
                            resolve({
                                success: false,
                                error: 'Image load failed'
                            });
                        };
                        
                        tempImg.src = blobUrl;
                    });
                """, elem_data['element'])
                
                # Ждем завершения
                time.sleep(5)
                
                if result and result.get('success'):
                    print(f"✅ Альтернативная конвертация успешна!")
                    print(f"📏 Размер: {result['width']}x{result['height']}")
                    print(f"📦 Data URL: {len(result['dataURL'])} байт")
                else:
                    print(f"❌ Альтернативная конвертация не удалась: {result.get('error')}")
                    
            except Exception as e:
                print(f"❌ Ошибка альтернативного метода: {e}")
        
    finally:
        driver.quit()
        print("\n🔚 Тест завершен")

if __name__ == "__main__":
    test_blob_conversion()
