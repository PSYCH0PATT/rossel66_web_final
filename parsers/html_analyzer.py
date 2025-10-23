#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTML Analyzer для анализа JSON ответов от парсера BandLink
Извлекает HTML из base64 и анализирует содержимое
"""

import json
import base64
import re
from typing import Dict, List, Optional, Tuple
import logging
import html.parser

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

class SimpleHTMLParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_tags = {}
        self.h1_tags = []
        self.forms = []
        self.scripts = []
        self.styles = []
        self.navigation = False
        self.in_title = False
        self.in_h1 = False
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == 'title':
            self.in_title = True
        elif tag == 'h1':
            self.in_h1 = True
        elif tag == 'meta':
            if 'name' in attrs_dict:
                self.meta_tags[attrs_dict['name']] = attrs_dict.get('content', '')
            elif 'property' in attrs_dict:
                self.meta_tags[attrs_dict['property']] = attrs_dict.get('content', '')
        elif tag == 'form':
            self.forms.append(attrs_dict)
        elif tag == 'script':
            self.scripts.append(attrs_dict)
        elif tag == 'style':
            self.styles.append(attrs_dict)
        elif tag == 'nav' or (tag in ['div', 'ul', 'ol'] and any('nav' in str(attr).lower() for attr in attrs)):
            self.navigation = True
    
    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif self.in_h1:
            self.h1_tags.append(data.strip())
    
    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        elif tag == 'h1':
            self.in_h1 = False

class HTMLAnalyzer:
    def __init__(self):
        self.parser = None
        self.html_content = ""
        
    def load_from_json_file(self, file_path: str) -> bool:
        """Загружает JSON файл и извлекает HTML"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Пытаемся распарсить как JSON
            try:
                data = json.loads(content)
                return self._extract_html_from_json(data)
            except json.JSONDecodeError:
                # Если не JSON, ищем HTML в тексте
                return self._extract_html_from_text(content)
                
        except Exception as e:
            logger.error(f"Ошибка загрузки файла {file_path}: {e}")
            return False
    
    def _extract_html_from_json(self, data: Dict) -> bool:
        """Извлекает HTML из JSON структуры"""
        try:
            # Ищем HTML в различных полях JSON
            html_fields = ['html', 'content', 'response', 'data', 'body']
            
            for field in html_fields:
                if field in data and data[field]:
                    if isinstance(data[field], str):
                        # Проверяем, это base64 или обычный HTML
                        if self._is_base64(data[field]):
                            html = base64.b64decode(data[field]).decode('utf-8')
                        else:
                            html = data[field]
                        
                        if self._is_valid_html(html):
                            self.html_content = html
                            self.parser = SimpleHTMLParser()
                            self.parser.feed(html)
                            logger.info(f"HTML найден в поле '{field}'")
                            return True
            
            # Если не нашли в стандартных полях, ищем рекурсивно
            return self._search_html_recursively(data)
            
        except Exception as e:
            logger.error(f"Ошибка извлечения HTML из JSON: {e}")
            return False
    
    def _extract_html_from_text(self, text: str) -> bool:
        """Извлекает HTML из текстового файла"""
        try:
            logger.info(f"Размер текста: {len(text)} символов")
            
            # Ищем JSON блоки в тексте
            json_pattern = r'\{[^{}]*"html"[^{}]*\}'
            matches = re.findall(json_pattern, text, re.DOTALL)
            logger.info(f"Найдено JSON блоков: {len(matches)}")
            
            for match in matches:
                try:
                    data = json.loads(match)
                    if self._extract_html_from_json(data):
                        return True
                except:
                    continue
            
            # Ищем HTML между маркерами HTML_BASE64_START и HTML_BASE64_END
            html_pattern = r'HTML_BASE64_START:([A-Za-z0-9+/=]+)HTML_BASE64_END'
            html_match = re.search(html_pattern, text)
            logger.info(f"Найден HTML между маркерами: {html_match is not None}")
            
            if html_match:
                try:
                    html_base64 = html_match.group(1)
                    logger.info(f"Размер base64 HTML: {len(html_base64)} символов")
                    decoded = base64.b64decode(html_base64).decode('utf-8')
                    logger.info(f"Размер декодированного HTML: {len(decoded)} символов")
                    if self._is_valid_html(decoded):
                        self.html_content = decoded
                        self.parser = SimpleHTMLParser()
                        self.parser.feed(decoded)
                        logger.info("HTML найден между маркерами HTML_BASE64_START/END")
                        return True
                    else:
                        logger.warning("Декодированный текст не является валидным HTML")
                except Exception as e:
                    logger.error(f"Ошибка декодирования HTML: {e}")
            
            # Ищем base64 HTML (более специфичный паттерн)
            base64_pattern = r'[A-Za-z0-9+/]{500,}={0,2}'
            matches = re.findall(base64_pattern, text)
            logger.info(f"Найдено base64 блоков: {len(matches)}")
            
            for match in matches:
                try:
                    decoded = base64.b64decode(match).decode('utf-8')
                    if self._is_valid_html(decoded):
                        self.html_content = decoded
                        self.parser = SimpleHTMLParser()
                        self.parser.feed(decoded)
                        logger.info("HTML найден в base64 формате")
                        return True
                except:
                    continue
            
            return False
            
        except Exception as e:
            logger.error(f"Ошибка извлечения HTML из текста: {e}")
            return False
    
    def _search_html_recursively(self, obj, depth=0) -> bool:
        """Рекурсивно ищет HTML в JSON структуре"""
        if depth > 10:  # Ограничиваем глубину поиска
            return False
            
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str) and len(value) > 100:
                    if self._is_base64(value):
                        try:
                            html = base64.b64decode(value).decode('utf-8')
                            if self._is_valid_html(html):
                                self.html_content = html
                                self.parser = SimpleHTMLParser()
                                self.parser.feed(html)
                                logger.info(f"HTML найден в поле '{key}'")
                                return True
                        except:
                            pass
                    elif self._is_valid_html(value):
                        self.html_content = value
                        self.parser = SimpleHTMLParser()
                        self.parser.feed(value)
                        logger.info(f"HTML найден в поле '{key}'")
                        return True
                
                if isinstance(value, (dict, list)):
                    if self._search_html_recursively(value, depth + 1):
                        return True
        
        elif isinstance(obj, list):
            for item in obj:
                if self._search_html_recursively(item, depth + 1):
                    return True
        
        return False
    
    def _is_base64(self, text: str) -> bool:
        """Проверяет, является ли строка base64"""
        try:
            if len(text) < 100:
                return False
            # Проверяем символы base64
            if re.match(r'^[A-Za-z0-9+/]*={0,2}$', text):
                # Пытаемся декодировать
                decoded = base64.b64decode(text)
                # Проверяем, что результат содержит текст
                return len(decoded) > 50
        except:
            pass
        return False
    
    def _is_valid_html(self, text: str) -> bool:
        """Проверяет, является ли текст валидным HTML"""
        if not text or len(text) < 100:
            return False
        
        # Проверяем наличие HTML тегов
        html_indicators = ['<html', '<!DOCTYPE', '<head>', '<body>', '<div', '<span']
        return any(indicator in text.lower() for indicator in html_indicators)
    
    def analyze_captcha(self) -> Dict:
        """Анализирует наличие капчи в HTML"""
        if not self.parser:
            return {"found": False, "type": None, "details": "HTML не загружен"}
        
        captcha_indicators = {
            "recaptcha": [
                "recaptcha", "g-recaptcha", "data-sitekey", 
                "google.com/recaptcha", "recaptcha/api"
            ],
            "hcaptcha": [
                "hcaptcha", "h-captcha", "hcaptcha.com"
            ],
            "cloudflare": [
                "cloudflare", "cf-challenge", "cf-browser-verification",
                "checking your browser", "ddos protection"
            ],
            "generic": [
                "captcha", "verification", "robot", "human", 
                "challenge", "security check"
            ]
        }
        
        found_captchas = []
        html_text = self.html_content.lower()
        
        for captcha_type, indicators in captcha_indicators.items():
            for indicator in indicators:
                if indicator in html_text:
                    found_captchas.append({
                        "type": captcha_type,
                        "indicator": indicator,
                        "found": True
                    })
        
        return {
            "found": len(found_captchas) > 0,
            "types": found_captchas,
            "count": len(found_captchas)
        }
    
    def extract_artist_data(self) -> Dict:
        """Извлекает данные артиста из HTML"""
        if not self.parser:
            return {"error": "HTML не загружен"}
        
        artist_data = {}
        
        # Ищем заголовок страницы
        if self.parser.title:
            artist_data['title'] = self.parser.title.strip()
        
        # Ищем мета-описание
        if 'description' in self.parser.meta_tags:
            artist_data['description'] = self.parser.meta_tags['description']
        
        # Ищем h1 заголовки
        if self.parser.h1_tags:
            artist_data['h1_tags'] = self.parser.h1_tags
        
        # Ищем информацию об артисте в тексте
        artist_patterns = [
            r'<[^>]*class="[^"]*artist[^"]*"[^>]*>([^<]+)</[^>]*>',
            r'<[^>]*class="[^"]*profile[^"]*"[^>]*>([^<]+)</[^>]*>',
            r'<h1[^>]*>([^<]+)</h1>',
            r'<h2[^>]*>([^<]+)</h2>'
        ]
        
        artist_matches = []
        for pattern in artist_patterns:
            matches = re.findall(pattern, self.html_content, re.IGNORECASE)
            artist_matches.extend(matches)
        
        if artist_matches:
            artist_data['artist_matches'] = artist_matches
        
        # Ищем статистику (подписчики, прослушивания и т.д.)
        stats_patterns = [
            r'(\d+[\s,]*\d*)\s*(подписчик|подписчиков|subscriber|followers)',
            r'(\d+[\s,]*\d*)\s*(прослушивание|прослушиваний|play|listens)',
            r'(\d+[\s,]*\d*)\s*(трек|треков|track|songs)'
        ]
        
        stats = {}
        page_text = re.sub(r'<[^>]+>', ' ', self.html_content)  # Убираем HTML теги
        
        for pattern in stats_patterns:
            matches = re.findall(pattern, page_text, re.IGNORECASE)
            if matches:
                stats[pattern] = matches
        
        artist_data['stats'] = stats
        
        return artist_data
    
    def get_page_info(self) -> Dict:
        """Получает общую информацию о странице"""
        if not self.parser:
            return {"error": "HTML не загружен"}
        
        return {
            "title": self.parser.title.strip() if self.parser.title else None,
            "url": self.parser.meta_tags.get('og:url', ''),
            "domain": self.parser.meta_tags.get('og:site_name', ''),
            "html_length": len(self.html_content),
            "has_navigation": self.parser.navigation,
            "has_forms": len(self.parser.forms) > 0,
            "has_scripts": len(self.parser.scripts) > 0,
            "has_styles": len(self.parser.styles) > 0
        }
    
    def save_html(self, output_path: str) -> bool:
        """Сохраняет извлеченный HTML в файл"""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(self.html_content)
            logger.info(f"HTML сохранен в {output_path}")
            return True
        except Exception as e:
            logger.error(f"Ошибка сохранения HTML: {e}")
            return False

def main():
    """Основная функция для тестирования"""
    import sys
    
    if len(sys.argv) < 2:
        print("Использование: python html_analyzer.py <путь_к_файлу>")
        return
    
    file_path = sys.argv[1]
    analyzer = HTMLAnalyzer()
    
    print(f"🔍 Анализ файла: {file_path}")
    print("=" * 50)
    
    # Включаем отладочное логирование
    logging.getLogger().setLevel(logging.INFO)
    
    if analyzer.load_from_json_file(file_path):
        print("✅ HTML успешно извлечен и загружен")
        
        # Анализ капчи
        captcha_info = analyzer.analyze_captcha()
        print(f"\n🤖 Анализ капчи:")
        print(f"   Найдена: {'Да' if captcha_info['found'] else 'Нет'}")
        if captcha_info['found']:
            for captcha in captcha_info['types']:
                print(f"   Тип: {captcha['type']} (индикатор: {captcha['indicator']})")
        
        # Информация о странице
        page_info = analyzer.get_page_info()
        print(f"\n📄 Информация о странице:")
        print(f"   Заголовок: {page_info.get('title', 'Не найден')}")
        print(f"   Домен: {page_info.get('domain', 'Не найден')}")
        print(f"   Размер HTML: {page_info.get('html_length', 0)} символов")
        print(f"   Навигация: {'Есть' if page_info.get('has_navigation') else 'Нет'}")
        print(f"   Формы: {page_info.get('has_forms', 0)}")
        
        # Данные артиста
        artist_data = analyzer.extract_artist_data()
        print(f"\n🎵 Данные артиста:")
        if 'title' in artist_data:
            print(f"   Заголовок: {artist_data['title']}")
        if 'h1_tags' in artist_data:
            print(f"   H1 теги: {artist_data['h1_tags']}")
        if 'stats' in artist_data and artist_data['stats']:
            print(f"   Статистика: {artist_data['stats']}")
        
        # Сохраняем HTML для дальнейшего анализа
        output_path = file_path.replace('.ini', '_extracted.html')
        if analyzer.save_html(output_path):
            print(f"\n💾 HTML сохранен в: {output_path}")
        
    else:
        print("❌ Не удалось извлечь HTML из файла")

if __name__ == "__main__":
    main()
