#!/usr/bin/env python3
"""
Простой тест blob конвертации - переходим сразу на страницу релиза
"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def quick_blob_test():
    """Быстрый тест конвертации blob"""
    
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Сразу переходим на страницу релиза (возможно сработает если сессия активна)
        print("🔍 Переход на страницу релиза...")
        driver.get("https://portal.koala-music.com/releases/44963")
        time.sleep(3)
        
        # Проверяем, не редиректит ли на страницу логина
        current_url = driver.current_url
        print(f"📍 Текущий URL: {current_url}")
        
        if 'login' in current_url or 'auth' in current_url:
            print("❌ Требуется авторизация, пробуем快速 вход...")
            
            # Быстрая попытка входа
            try:
                username = driver.find_element(By.NAME, "username")
                password = driver.find_element(By.NAME, "password")
                
                username.clear()
                username.send_keys("Maks.lat@bk.ru")
                password.clear()
                password.send_keys("IXLth1gU5v")
                
                driver.find_element(By.CSS_SELECTOR, "input[type='submit']").submit()
                time.sleep(5)
                
                # Снова переходим на страницу релиза
                driver.get("https://portal.koala-music.com/releases/44963")
                time.sleep(5)
                
            except Exception as e:
                print(f"❌ Ошибка авторизации: {e}")
                return
        
        # Ищем элементы с background-image
        print("🎯 Поиск background-image с blob...")
        
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
                        className: elem.className
                    });
                }
            }
            return elements;
        """)
        
        print(f"📸 Найдено элементов: {len(elements_with_bg)}")
        
        if not elements_with_bg:
            # Ищем все изображения как fallback
            print("🔄 Ищем обычные изображения...")
            all_images = driver.find_elements(By.TAG_NAME, "img")
            print(f"📸 Всего изображений: {len(all_images)}")
            
            for i, img in enumerate(all_images[:5]):  # Первые 5 изображений
                try:
                    src = img.get_attribute('src') or "NO_SRC"
                    alt = img.get_attribute('alt') or "NO_ALT"
                    print(f"   Img #{i+1}: {src[:50]}... ALT={alt}")
                    
                    if src.startswith('blob:'):
                        print(f"   🔄 НАЙДЕН BLOB! Пробуем конвертировать...")
                        
                        # Простая конвертация
                        result = driver.execute_script("""
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
                        """, img)
                        
                        if result.get('success'):
                            print(f"   ✅ УСПЕХ! {result['width']}x{result['height']}")
                            print(f"   📦 Data URL: {len(result['dataURL'])} байт")
                            return result
                        else:
                            print(f"   ❌ Ошибка: {result.get('error')}")
                except Exception as e:
                    print(f"   ❌ Ошибка обработки: {e}")
        else:
            # Работаем с background-image
            elem_data = elements_with_bg[0]
            bg_image = elem_data['backgroundImage']
            print(f"🎯 Найден background-image: {bg_image[:100]}...")
            
            # Извлекаем blob URL
            import re
            blob_match = re.search(r'blob:[^"]+', bg_image)
            if blob_match:
                blob_url = blob_match.group(0)
                print(f"🔄 Blob URL: {blob_url}")
                
                # Создаем тестовое изображение
                result = driver.execute_script("""
                    var blobUrl = arguments[0];
                    
                    return new Promise(function(resolve) {
                        var img = new Image();
                        img.crossOrigin = 'anonymous';
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
                """, blob_url)
                
                # Ждем результат
                time.sleep(3)
                
                if result and result.get('success'):
                    print(f"✅ КОНВЕРТАЦИЯ УСПЕШНА!")
                    print(f"📏 Размер: {result['width']}x{result['height']}")
                    print(f"📦 Data URL: {result['size']} байт")
                    return result
                else:
                    print(f"❌ Ошибка конвертации: {result.get('error')}")
        
        print("❌ Не найдено blob изображений для теста")
        
    finally:
        driver.quit()
        print("🔚 Тест завершен")

if __name__ == "__main__":
    quick_blob_test()
