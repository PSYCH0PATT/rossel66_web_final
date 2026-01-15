#!/usr/bin/env python3
"""
Тест реального blob URL с Koala Music
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

def test_real_koala_blob():
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Используем реальный blob URL с сайта
        real_blob_url = "blob:https://portal.koala-music.com/9aa7b067-4166-4911-b45a-154dedd69dc8"
        
        print(f"🧪 Тестируем реальный blob URL:")
        print(f"🔗 {real_blob_url}")
        print("=" * 80)
        
        # Тестируем конвертацию реального blob URL
        result = driver.execute_script("""
            var blobUrl = arguments[0];
            
            return new Promise(function(resolve) {
                var img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    try {
                        console.log('Image loaded successfully');
                        console.log('Natural size:', img.naturalWidth + 'x' + img.naturalHeight);
                        console.log('Display size:', img.width + 'x' + img.height);
                        
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
                            size: dataURL.length,
                            displayWidth: img.width,
                            displayHeight: img.height
                        });
                    } catch(e) {
                        console.error('Canvas error:', e);
                        resolve({
                            success: false,
                            error: e.toString()
                        });
                    }
                };
                img.onerror = function() {
                    console.error('Image load failed');
                    resolve({
                        success: false,
                        error: 'Image load failed - blob URL may be expired or invalid'
                    });
                };
                img.onabort = function() {
                    console.error('Image load aborted');
                    resolve({
                        success: false,
                        error: 'Image load aborted'
                    });
                };
                
                console.log('Starting to load blob URL...');
                img.src = blobUrl;
            });
        """, real_blob_url)
        
        # Ждем результат асинхронной операции
        time.sleep(5)
        
        if result and result.get('success'):
            print("✅ КОНВЕРТАЦИЯ УСПЕШНА!")
            print(f"📏 Размер изображения: {result['width']}x{result['height']}")
            print(f"📦 Data URL размер: {result['size']} байт")
            print(f"🖼️ Display размер: {result['displayWidth']}x{result['displayHeight']}")
            
            # Сохраняем полный data URL
            full_data_url = result['dataURL']
            print(f"🔗 ПОЛНЫЙ DATA URL:")
            print("=" * 80)
            print(full_data_url[:200] + "...")
            print("=" * 80)
            
            # Сохраняем в файл
            with open('real_koala_cover_data_url.txt', 'w') as f:
                f.write(full_data_url)
            print("💾 Сохранен в файл: real_koala_cover_data_url.txt")
            
            # Дополнительно проверяем валидность data URL
            verification = driver.execute_script("""
                var dataURL = arguments[0];
                var img = new Image();
                img.onload = function() {
                    window.verificationResult = {
                        success: true,
                        width: this.naturalWidth,
                        height: this.naturalHeight,
                        valid: true
                    };
                };
                img.onerror = function() {
                    window.verificationResult = {
                        success: false,
                        error: 'Data URL verification failed'
                    };
                };
                img.src = dataURL;
                return window.verificationResult;
            """, full_data_url)
            
            time.sleep(2)
            
            if verification and verification.get('success'):
                print(f"✅ ВЕРИФИКАЦИЯ УСПЕШНА: {verification['width']}x{verification['height']}")
            else:
                print(f"❌ Ошибка верификации: {verification.get('error')}")
                
        else:
            print("❌ КОНВЕРТАЦИЯ НЕ УДАЛАСЬ")
            print(f"🚨 Ошибка: {result.get('error') if result else 'No result'}")
            
            # Пробуем альтернативный метод
            print("\n🔄 Пробуем альтернативный метод...")
            
            alt_result = driver.execute_script("""
                var blobUrl = arguments[0];
                
                // Создаем временный div с background-image
                var div = document.createElement('div');
                div.style.width = '300px';
                div.style.height = '300px';
                div.style.backgroundImage = 'url(' + blobUrl + ')';
                div.style.backgroundSize = 'cover';
                div.style.backgroundPosition = 'center center';
                div.style.position = 'absolute';
                div.style.left = '-9999px';
                div.style.top = '-9999px';
                document.body.appendChild(div);
                
                // Ждем загрузки
                setTimeout(function() {
                    try {
                        var canvas = document.createElement('canvas');
                        var ctx = canvas.getContext('2d');
                        canvas.width = 300;
                        canvas.height = 300;
                        
                        // Пробуем нарисовать background-image
                        ctx.drawImage(div, 0, 0, 300, 300);
                        
                        var dataURL = canvas.toDataURL('image/jpeg', 0.8);
                        
                        document.body.removeChild(div);
                        
                        window.altResult = {
                            success: true,
                            dataURL: dataURL,
                            size: dataURL.length
                        };
                    } catch(e) {
                        document.body.removeChild(div);
                        window.altResult = {
                            success: false,
                            error: e.toString()
                        };
                    }
                }, 2000);
                
                return window.altResult;
            """, real_blob_url)
            
            time.sleep(4)
            
            if alt_result and alt_result.get('success'):
                print("✅ АЛЬТЕРНАТИВНЫЙ МЕТТОД УСПЕШЕН!")
                print(f"📦 Data URL размер: {alt_result['size']} байт")
            else:
                print(f"❌ Альтернативный метод не удался: {alt_result.get('error')}")
        
    finally:
        driver.quit()
        print("\n🔚 Тест завершен")

if __name__ == "__main__":
    test_real_koala_blob()
