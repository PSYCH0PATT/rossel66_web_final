#!/usr/bin/env python3
"""
Получаем полный data URL для проверки
"""

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def get_full_data_url():
    chrome_options = Options()
    chrome_options.add_argument('--headless=new')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
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
            
            // Добавляем текст для идентификации
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '20px Arial';
            ctx.fillText('TEST', 75, 105);
            
            // Конвертируем в data URL
            var dataURL = canvas.toDataURL('image/jpeg', 0.8);
            
            return {
                dataURL: dataURL,
                length: dataURL.length
            };
        """)
        
        if result:
            print("🔗 ПОЛНЫЙ DATA URL:")
            print("=" * 80)
            print(result['dataURL'])
            print("=" * 80)
            print(f"📦 Длина: {result['length']} символов")
            
            # Сохраняем в файл для удобства
            with open('test_cover_data_url.txt', 'w') as f:
                f.write(result['dataURL'])
            print("💾 Сохранен в файл: test_cover_data_url.txt")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    get_full_data_url()
