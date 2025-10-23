#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализатор ответа с ошибкой от API
"""

import json
import sys
import re

def analyze_error_response(filename):
    """Анализирует ответ с ошибкой"""
    print("="*60)
    print("🔍 АНАЛИЗ ОТВЕТА С ОШИБКОЙ")
    print("="*60)
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"📊 Размер файла: {len(content)} символов")
        
        # Пытаемся найти JSON
        json_start = content.find('{"success":false')
        if json_start == -1:
            print("❌ JSON не найден в файле")
            return
        
        # Ищем конец JSON (последняя закрывающая скобка)
        json_end = content.rfind('}')
        if json_end == -1:
            print("❌ Конец JSON не найден")
            return
        
        json_content = content[json_start:json_end+1]
        print(f"📄 JSON размер: {len(json_content)} символов")
        
        # Парсим JSON
        try:
            data = json.loads(json_content)
            print("✅ JSON успешно распарсен")
            
            # Анализируем структуру
            print(f"\n📋 Ключи в ответе: {list(data.keys())}")
            print(f"🎯 Success: {data.get('success')}")
            print(f"❌ Error: {data.get('error')}")
            
            # Анализируем output
            output = data.get('output', '')
            if output:
                print(f"\n📊 Output размер: {len(output)} символов")
                
                # Ищем HTML в base64
                html_match = re.search(r'HTML_BASE64_START:(.+?):HTML_BASE64_END', output)
                if html_match:
                    print("✅ HTML найден в base64!")
                    html_b64 = html_match.group(1)
                    print(f"📄 HTML base64 размер: {len(html_b64)} символов")
                    
                    # Декодируем HTML
                    import base64
                    try:
                        html = base64.b64decode(html_b64).decode('utf-8')
                        print(f"📄 HTML размер: {len(html)} символов")
                        
                        # Анализируем HTML
                        analyze_html_content(html)
                        
                    except Exception as e:
                        print(f"❌ Ошибка декодирования HTML: {e}")
                else:
                    print("⚠️ HTML не найден в output")
                
                # Ищем ошибки в логах
                error_indicators = ['ERROR', '❌', 'Exception', 'Traceback', 'Failed', 'Error']
                for indicator in error_indicators:
                    if indicator in output:
                        print(f"⚠️ Найден индикатор ошибки: '{indicator}'")
                
                # Показываем последние строки логов
                lines = output.split('\n')
                print(f"\n📋 Последние 10 строк логов:")
                for line in lines[-10:]:
                    if line.strip():
                        print(f"   {line}")
            else:
                print("⚠️ Output пустой")
            
            # Анализируем stderr
            stderr = data.get('stderr', '')
            if stderr:
                print(f"\n❌ Stderr: {stderr}")
            else:
                print("\n✅ Stderr пустой")
                
        except json.JSONDecodeError as e:
            print(f"❌ Ошибка парсинга JSON: {e}")
            print("📄 Первые 500 символов JSON:")
            print(json_content[:500])
            
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")

def analyze_html_content(html):
    """Анализирует содержимое HTML"""
    print("\n" + "="*60)
    print("🔍 АНАЛИЗ HTML")
    print("="*60)
    
    # Проверяем наличие капчи
    captcha_indicators = ['captcha', 'showcaptcha', 'smartcaptcha', 'yandex', 'я не робот']
    captcha_found = False
    
    for indicator in captcha_indicators:
        if indicator.lower() in html.lower():
            count = html.lower().count(indicator.lower())
            print(f"⚠️ Найден '{indicator}': {count} раз")
            captcha_found = True
    
    if not captcha_found:
        print("✅ Капча не обнаружена")
    
    # Ищем плейлисты
    playlist_platforms = ['spotify.com', 'music.apple.com', 'youtube.com/playlist', 'music.yandex.ru']
    playlists_found = False
    
    for platform in playlist_platforms:
        if platform in html:
            count = html.count(platform)
            print(f"✅ Найдены ссылки на {platform}: {count} раз")
            playlists_found = True
    
    if not playlists_found:
        print("❌ Плейлисты не найдены")
    
    # Ищем заголовок
    import re
    title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE)
    if title_match:
        print(f"📄 Заголовок: {title_match.group(1)}")
    
    print(f"📊 Размер HTML: {len(html)} символов")
    print("="*60)

def main():
    if len(sys.argv) < 2:
        print("Использование: python3 analyze_error_response.py <файл_с_ответом>")
        sys.exit(1)
    
    filename = sys.argv[1]
    analyze_error_response(filename)

if __name__ == "__main__":
    main()



