#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Простой скрипт для извлечения HTML из файла с логами парсера
"""

import re
import base64
import sys

def extract_html_from_file(file_path):
    """Извлекает HTML из файла"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"Размер файла: {len(content)} символов")
        
        # Ищем HTML между маркерами по позициям
        start_pos = content.find('HTML_BASE64_START:')
        end_pos = content.find('HTML_BASE64_END')
        
        if start_pos != -1 and end_pos != -1:
            print("✅ Найден HTML между маркерами")
            html_base64 = content[start_pos + len('HTML_BASE64_START:'):end_pos]
            print(f"Размер base64: {len(html_base64)} символов")
            
            try:
                decoded = base64.b64decode(html_base64).decode('utf-8')
                print(f"Размер декодированного HTML: {len(decoded)} символов")
                
                # Сохраняем HTML
                output_path = file_path.replace('.ini', '_extracted.html')
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(decoded)
                print(f"💾 HTML сохранен в: {output_path}")
                
                # Анализируем HTML
                analyze_html(decoded)
                
                return True
            except Exception as e:
                print(f"❌ Ошибка декодирования: {e}")
                return False
        else:
            print("❌ HTML между маркерами не найден")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        return False

def analyze_html(html_content):
    """Анализирует HTML контент"""
    print("\n🔍 Анализ HTML:")
    print("=" * 50)
    
    # Проверяем наличие капчи
    captcha_indicators = [
        "recaptcha", "g-recaptcha", "data-sitekey", 
        "google.com/recaptcha", "recaptcha/api",
        "hcaptcha", "h-captcha", "hcaptcha.com",
        "cloudflare", "cf-challenge", "cf-browser-verification",
        "checking your browser", "ddos protection",
        "captcha", "verification", "robot", "human", 
        "challenge", "security check"
    ]
    
    found_captchas = []
    html_lower = html_content.lower()
    
    for indicator in captcha_indicators:
        if indicator in html_lower:
            found_captchas.append(indicator)
    
    if found_captchas:
        print(f"🤖 Найдена капча: {', '.join(found_captchas)}")
    else:
        print("✅ Капча не обнаружена")
    
    # Ищем заголовок
    title_match = re.search(r'<title[^>]*>([^<]+)</title>', html_content, re.IGNORECASE)
    if title_match:
        print(f"📄 Заголовок: {title_match.group(1).strip()}")
    
    # Ищем h1 теги
    h1_matches = re.findall(r'<h1[^>]*>([^<]+)</h1>', html_content, re.IGNORECASE)
    if h1_matches:
        print(f"📝 H1 теги: {h1_matches}")
    
    # Ищем информацию об артисте
    artist_patterns = [
        r'<[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)</[^>]*>',
        r'<[^>]*class="[^"]*profile[^"]*"[^>]*>([^<]+)</[^>]*>'
    ]
    
    artist_matches = []
    for pattern in artist_patterns:
        matches = re.findall(pattern, html_content, re.IGNORECASE)
        artist_matches.extend(matches)
    
    if artist_matches:
        print(f"🎵 Найдена информация об артисте: {artist_matches[:5]}")  # Показываем первые 5
    
    # Ищем статистику
    stats_patterns = [
        r'(\d+[\s,]*\d*)\s*(подписчик|подписчиков|subscriber|followers)',
        r'(\d+[\s,]*\d*)\s*(прослушивание|прослушиваний|play|listens)',
        r'(\d+[\s,]*\d*)\s*(трек|треков|track|songs)'
    ]
    
    stats = {}
    for pattern in stats_patterns:
        matches = re.findall(pattern, html_content, re.IGNORECASE)
        if matches:
            stats[pattern] = matches
    
    if stats:
        print(f"📊 Статистика: {stats}")
    
    # Проверяем наличие форм
    forms = re.findall(r'<form[^>]*>', html_content, re.IGNORECASE)
    print(f"📋 Формы: {len(forms)}")
    
    # Проверяем наличие скриптов
    scripts = re.findall(r'<script[^>]*>', html_content, re.IGNORECASE)
    print(f"🔧 Скрипты: {len(scripts)}")

def main():
    if len(sys.argv) < 2:
        print("Использование: python extract_html.py <путь_к_файлу>")
        return
    
    file_path = sys.argv[1]
    print(f"🔍 Извлечение HTML из: {file_path}")
    print("=" * 50)
    
    if extract_html_from_file(file_path):
        print("\n✅ HTML успешно извлечен и проанализирован")
    else:
        print("\n❌ Не удалось извлечь HTML")

if __name__ == "__main__":
    main()
