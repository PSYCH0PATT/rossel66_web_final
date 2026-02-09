#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сравнение релизов из Zvonko с существующими в системе
"""

import json
import logging
import os
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Определяем базовую директорию проекта
BASE_DIR = Path(__file__).resolve().parent.parent
PARSERS_DIR = BASE_DIR / 'parsers'
DATA_DIR = BASE_DIR / 'data'

# Создаём директории если их нет
PARSERS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

def load_zvonko_releases():
    """Загружает релизы из Zvonko"""
    try:
        zvonko_file = PARSERS_DIR / 'zvonko_all_releases_full.json'
        if not zvonko_file.exists():
            logger.warning(f"Файл {zvonko_file} не найден, создаём пустой")
            zvonko_file.write_text('[]', encoding='utf-8')
            return []
        with open(zvonko_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки Zvonko релизов: {e}")
        return []

def load_system_releases():
    """Загружает релизы из системы"""
    try:
        releases_file = DATA_DIR / 'releases.json'
        if not releases_file.exists():
            logger.warning(f"Файл {releases_file} не найден, создаём пустой")
            releases_file.write_text('[]', encoding='utf-8')
            return []
        with open(releases_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Ошибка загрузки системных релизов: {e}")
        return []

def normalize_title(title):
    """Нормализует название для сравнения"""
    return title.lower().strip()

def normalize_upc(upc):
    """Нормализует UPC"""
    return upc.strip().lstrip('0')  # Удаляем ведущие нули

def compare_releases():
    """Сравнивает релизы"""
    logger.info("🔍 Начало сравнения релизов...")
    
    # Загружаем данные
    zvonko_releases = load_zvonko_releases()
    system_releases = load_system_releases()
    
    logger.info(f"📊 Загружено {len(zvonko_releases)} релизов из Zvonko")
    logger.info(f"📊 Загружено {len(system_releases)} релизов из системы")
    
    # Создаем словари существующих релизов для быстрого поиска
    system_by_upc = {}
    system_by_title = {}
    
    for release in system_releases:
        # Индекс по UPC
        if release.get('upc'):
            normalized_upc = normalize_upc(release['upc'])
            system_by_upc[normalized_upc] = release
        
        # Индекс по названию
        if release.get('title'):
            normalized_title = normalize_title(release['title'])
            system_by_title[normalized_title] = release
    
    # Анализируем релизы из Zvonko
    new_releases = []
    existing_by_upc = []
    existing_by_title = []
    duplicates_in_zvonko = []
    
    processed_titles = set()
    processed_upcs = set()
    
    for zvonko_release in zvonko_releases:
        zvonko_title = zvonko_release.get('title', '')
        zvonko_upc = zvonko_release.get('upc', '')
        
        # Проверяем дубликаты внутри Zvonko
        title_key = normalize_title(zvonko_title)
        upc_key = normalize_upc(zvonko_upc) if zvonko_upc else ''
        
        if title_key in processed_titles:
            duplicates_in_zvonko.append(zvonko_release)
            continue
        processed_titles.add(title_key)
        
        if upc_key and upc_key in processed_upcs:
            duplicates_in_zvonko.append(zvonko_release)
            continue
        if upc_key:
            processed_upcs.add(upc_key)
        
        # Проверяем по UPC
        if zvonko_upc:
            normalized_upc = normalize_upc(zvonko_upc)
            if normalized_upc in system_by_upc:
                existing_by_upc.append({
                    'zvonko': zvonko_release,
                    'system': system_by_upc[normalized_upc],
                    'match_type': 'UPC'
                })
                continue
        
        # Проверяем по названию
        if zvonko_title:
            normalized_title = normalize_title(zvonko_title)
            if normalized_title in system_by_title:
                existing_by_title.append({
                    'zvonko': zvonko_release,
                    'system': system_by_title[normalized_title],
                    'match_type': 'Title'
                })
                continue
        
        # Если не найдено - новый релиз
        new_releases.append(zvonko_release)
    
    # Выводим результаты
    logger.info(f"\n📊 Результаты сравнения:")
    logger.info(f"  ✅ Новые релизы: {len(new_releases)}")
    logger.info(f"  🔄 Существующие (по UPC): {len(existing_by_upc)}")
    logger.info(f"  🔄 Существующие (по названию): {len(existing_by_title)}")
    logger.info(f"  🔄 Дубликаты в Zvonko: {len(duplicates_in_zvonko)}")
    
    # Сохраняем результаты
    results = {
        'summary': {
            'total_zvonko': len(zvonko_releases),
            'total_system': len(system_releases),
            'new_releases': len(new_releases),
            'existing_by_upc': len(existing_by_upc),
            'existing_by_title': len(existing_by_title),
            'duplicates_in_zvonko': len(duplicates_in_zvonko)
        },
        'new_releases': new_releases,
        'existing_by_upc': existing_by_upc,
        'existing_by_title': existing_by_title,
        'duplicates_in_zvonko': duplicates_in_zvonko
    }
    
    results_file = PARSERS_DIR / 'comparison_results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    logger.info("📄 Результаты сохранены в comparison_results.json")
    
    # Показываем примеры новых релизов
    if new_releases:
        logger.info(f"\n🎵 Примеры новых релизов (первые 10):")
        for i, release in enumerate(new_releases[:10]):
            logger.info(f"  {i+1}. {release.get('title', 'N/A')} - {release.get('artist', 'N/A')} (UPC: {release.get('upc', 'N/A')})")
    
    # Показываем примеры существующих
    if existing_by_upc:
        logger.info(f"\n🔄 Примеры существующих (по UPC) (первые 5):")
        for i, item in enumerate(existing_by_upc[:5]):
            zvonko = item['zvonko']
            system = item['system']
            logger.info(f"  {i+1}. {zvonko.get('title', 'N/A')} - {zvonko.get('artist', 'N/A')}")
            logger.info(f"     Системный: {system.get('title', 'N/A')} (ID: {system.get('id', 'N/A')})")
    
    if existing_by_title:
        logger.info(f"\n🔄 Примеры существующих (по названию) (первые 5):")
        for i, item in enumerate(existing_by_title[:5]):
            zvonko = item['zvonko']
            system = item['system']
            logger.info(f"  {i+1}. {zvonko.get('title', 'N/A')} - {zvonko.get('artist', 'N/A')}")
            logger.info(f"     Системный: {system.get('title', 'N/A')} (ID: {system.get('id', 'N/A')})")
    
    return results

if __name__ == "__main__":
    results = compare_releases()
    
    print(f"\n🎉 Сравнение завершено!")
    print(f"📊 Всего новых релизов для добавления: {results['summary']['new_releases']}")
    print(f"📄 Детальные результаты сохранены в comparison_results.json")
