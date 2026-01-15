#!/usr/bin/env python3
"""
Простой тест конвертации blob URL - без авторизации
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def test_blob_conversion():
    """Тестируем конвертацию blob URL"""
    
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # Создаем тестовый blob URL и изображение
        print("🧪 Создаем тестовый blob URL...")
        
        result = driver.execute_script("""
            // Создаем тестовое изображение
            var canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            var ctx = canvas.getContext('2d');
            
            // Рисуем простое изображение
            ctx.fillStyle = '#FF6B6B';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = '#4ECDC4';
            ctx.beginPath();
            ctx.arc(100, 100, 50, 0, 2 * Math.PI);
            ctx.fill();
            
            // Конвертируем в blob
            canvas.toBlob(function(blob) {
                // Создаем blob URL
                var blobUrl = URL.createObjectURL(blob);
                
                // Создаем изображение с этим blob URL
                var img = new Image();
                img.onload = function() {
                    // Пробуем конвертировать обратно в data URL
                    try {
                        var newCanvas = document.createElement('canvas');
                        var newCtx = newCanvas.getContext('2d');
                        newCanvas.width = img.naturalWidth;
                        newCanvas.height = img.naturalHeight;
                        newCtx.drawImage(img, 0, 0);
                        
                        var dataURL = newCanvas.toDataURL('image/jpeg', 0.8);
                        
                        // Сохраняем результат
                        window.blobTestResult = {
                            success: true,
                            originalBlob: blobUrl,
                            dataURL: dataURL,
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                            dataSize: dataURL.length
                        };
                        
                        console.log('✅ Blob конвертация успешна!');
                        console.log('Размер:', img.naturalWidth + 'x' + img.naturalHeight);
                        console.log('Data URL размер:', dataURL.length + ' байт');
                        
                    } catch(e) {
                        window.blobTestResult = {
                            success: false,
                            error: e.toString()
                        };
                        console.error('❌ Ошибка конвертации:', e);
                    }
                };
                
                img.onerror = function() {
                    window.blobTestResult = {
                        success: false,
                        error: 'Image load failed'
                    };
                    console.error('❌ Ошибка загрузки изображения');
                };
                
                img.src = blobUrl;
            }, 'image/jpeg', 0.8);
            
            // Возвращаем промис
            return new Promise(function(resolve) {
                setTimeout(function() {
                    resolve(window.blobTestResult || { success: false, error: 'Timeout' });
                }, 2000);
            });
        """)
        
        # Ждем результат
        import time
        time.sleep(3)
        
        # Проверяем результат
        if result and result.get('success'):
            print("✅ ТЕСТ УСПЕШЕН!")
            print(f"📏 Размер изображения: {result['width']}x{result['height']}")
            print(f"📦 Data URL размер: {result['dataSize']} байт")
            print(f"🔗 Data URL: {result['dataURL'][:100]}...")
            print(f"🔄 Original blob: {result['originalBlob']}")
            
            # Дополнительно проверим, что data URL действительно работает
            verification = driver.execute_script("""
                var dataURL = arguments[0];
                var img = new Image();
                img.onload = function() {
                    window.verificationResult = {
                        success: true,
                        width: this.naturalWidth,
                        height: this.naturalHeight
                    };
                };
                img.onerror = function() {
                    window.verificationResult = {
                        success: false,
                        error: 'Data URL load failed'
                    };
                };
                img.src = dataURL;
                return window.verificationResult;
            """, result['dataURL'])
            
            time.sleep(1)
            
            if verification and verification.get('success'):
                print(f"✅ ВЕРИФИКАЦИЯ УСПЕШНА: {verification['width']}x{verification['height']}")
            else:
                print(f"❌ Ошибка верификации: {verification.get('error')}")
                
        else:
            print(f"❌ Тест не удался: {result.get('error') if result else 'No result'}")
        
        # Теперь протестируем с background-image
        print("\n🎯 Тестируем background-image с blob...")
        
        bg_result = driver.execute_script("""
            // Создаем элемент с background-image
            var div = document.createElement('div');
            div.style.width = '200px';
            div.style.height = '200px';
            div.style.backgroundImage = 'url(' + arguments[0] + ')';
            div.style.backgroundSize = 'cover';
            div.style.backgroundPosition = 'center center';
            document.body.appendChild(div);
            
            // Получаем computed style
            var style = window.getComputedStyle(div);
            var bgImage = style.backgroundImage;
            
            // Извлекаем blob URL
            var blobMatch = bgImage.match(/blob:[^)]+/);
            
            document.body.removeChild(div);
            
            return {
                backgroundImage: bgImage,
                blobUrl: blobMatch ? blobMatch[0] : null,
                found: !!blobMatch
            };
        """, result.get('originalBlob', ''))
        
        if bg_result.get('found'):
            print(f"✅ Background-image с blob найден!")
            print(f"🔗 Blob URL: {bg_result['blobUrl']}")
            print(f"🎨 Background: {bg_result['backgroundImage'][:100]}...")
        else:
            print(f"❌ Background-image с blob не найден")
        
    finally:
        driver.quit()
        print("\n🔚 Тест завершен")

if __name__ == "__main__":
    test_blob_conversion()
