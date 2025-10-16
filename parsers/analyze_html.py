#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Анализатор HTML от Bandlink парсера
Помогает понять, что содержится в полученном HTML
"""

import sys
import re
from bs4 import BeautifulSoup

def analyze_html(html_content):
    """Анализирует HTML и выводит полезную информацию"""
    print("="*60)
    print("🔍 АНАЛИЗ HTML ОТ BANDLINK")
    print("="*60)
    
    # Основная информация
    print(f"📊 Размер HTML: {len(html_content)} символов")
    
    # Проверяем наличие капчи
    captcha_indicators = [
        'captcha', 'showcaptcha', 'smartcaptcha', 'yandex',
        'я не робот', 'i am not a robot', 'checkbox'
    ]
    
    print("\n🔒 ПРОВЕРКА КАПЧИ:")
    captcha_found = False
    for indicator in captcha_indicators:
        if indicator.lower() in html_content.lower():
            count = html_content.lower().count(indicator.lower())
            print(f"   ⚠️ Найден '{indicator}': {count} раз")
            captcha_found = True
    
    if not captcha_found:
        print("   ✅ Капча не обнаружена")
    
    # Парсим HTML
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        print(f"\n📄 ЗАГОЛОВОК СТРАНИЦЫ: {soup.title.string if soup.title else 'Не найден'}")
        
        # Ищем ссылки на плейлисты
        print("\n🎵 ПОИСК ПЛЕЙЛИСТОВ:")
        playlist_platforms = {
            'spotify': 'spotify.com',
            'apple': 'music.apple.com',
            'youtube': 'youtube.com/playlist',
            'yandex': 'music.yandex.ru',
            'vk': 'vk.com/music',
            'deezer': 'deezer.com'
        }
        
        found_playlists = {}
        for platform, domain in playlist_platforms.items():
            links = soup.find_all('a', href=True)
            platform_links = [link for link in links if domain in link.get('href', '')]
            if platform_links:
                found_playlists[platform] = len(platform_links)
                print(f"   ✅ {platform.upper()}: {len(platform_links)} ссылок")
                
                # Показываем первые 3 ссылки
                for i, link in enumerate(platform_links[:3]):
                    href = link.get('href', '')
                    text = link.get_text(strip=True) or 'Без текста'
                    print(f"      {i+1}. {text[:50]}... -> {href[:80]}...")
        
        if not found_playlists:
            print("   ❌ Плейлисты не найдены")
        
        # Ищем результаты поиска
        print("\n🔍 РЕЗУЛЬТАТЫ ПОИСКА:")
        search_indicators = [
            'search results', 'результаты поиска', 'found', 'найдено',
            'artist', 'артист', 'music', 'музыка'
        ]
        
        for indicator in search_indicators:
            if indicator.lower() in html_content.lower():
                print(f"   ✅ Найден индикатор: '{indicator}'")
        
        # Ищем ошибки
        print("\n❌ ПРОВЕРКА ОШИБОК:")
        error_indicators = [
            'error', 'ошибка', 'not found', 'не найден', '404', '500',
            'access denied', 'доступ запрещен', 'blocked', 'заблокирован'
        ]
        
        errors_found = False
        for indicator in error_indicators:
            if indicator.lower() in html_content.lower():
                print(f"   ⚠️ Найден индикатор ошибки: '{indicator}'")
                errors_found = True
        
        if not errors_found:
            print("   ✅ Ошибки не обнаружены")
        
        # Анализ структуры страницы
        print("\n📋 СТРУКТУРА СТРАНИЦЫ:")
        print(f"   📄 Тегов <div>: {len(soup.find_all('div'))}")
        print(f"   🔗 Тегов <a>: {len(soup.find_all('a'))}")
        print(f"   📝 Тегов <span>: {len(soup.find_all('span'))}")
        print(f"   🖼️ Тегов <img>: {len(soup.find_all('img'))}")
        
        # Ищем JavaScript
        scripts = soup.find_all('script')
        if scripts:
            print(f"   ⚙️ JavaScript блоков: {len(scripts)}")
        
        # Ищем iframe (часто используется для капчи)
        iframes = soup.find_all('iframe')
        if iframes:
            print(f"   🖼️ iframe элементов: {len(iframes)}")
            for i, iframe in enumerate(iframes[:3]):
                src = iframe.get('src', '')
                print(f"      {i+1}. {src[:80]}...")
        
    except Exception as e:
        print(f"❌ Ошибка парсинга HTML: {e}")
    
    print("\n" + "="*60)
    print("📊 ИТОГИ АНАЛИЗА:")
    
    if captcha_found:
        print("❌ В HTML присутствует капча - Web Unlocker API не смог её решить")
    elif found_playlists:
        print("✅ HTML содержит плейлисты - парсинг должен работать!")
        print("💡 Возможно, логика проверки капчи слишком строгая")
    else:
        print("⚠️ HTML получен, но плейлисты не найдены")
        print("💡 Возможно, нужно улучшить селекторы для поиска плейлистов")
    
    print("="*60)

def main():
    if len(sys.argv) < 2:
        print("Использование: python3 analyze_html.py <путь_к_html_файлу>")
        print("Или: python3 analyze_html.py <html_содержимое>")
        sys.exit(1)
    
    input_data = sys.argv[1]
    
    # Если это путь к файлу
    if input_data.endswith('.html') or '/' in input_data:
        try:
            with open(input_data, 'r', encoding='utf-8') as f:
                html_content = f.read()
            print(f"📁 Загружен HTML из файла: {input_data}")
        except Exception as e:
            print(f"❌ Ошибка чтения файла: {e}")
            sys.exit(1)
    else:
        # Если это HTML содержимое
        html_content = input_data
        print("📄 Анализируем переданное HTML содержимое")
    
    analyze_html(html_content)

if __name__ == "__main__":
    main()
