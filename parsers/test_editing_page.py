#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый скрипт для проверки парсинга страницы editing
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from zvonko_linux_parser import ZvonkoLinuxParser
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_editing_page():
    """Тестирует только парсинг страницы editing"""
    logger.info("🧪 Запуск теста парсинга страницы editing...")
    
    parser = ZvonkoLinuxParser(max_pages=1)
    
    try:
        # Настройка драйвера
        if not parser.setup_driver():
            logger.error("❌ Не удалось настроить WebDriver")
            return False
        
        # Авторизация
        if not parser.login_to_zvonko():
            logger.error("❌ Не удалось авторизоваться")
            return False
        
        # Парсинг только страницы editing
        logger.info("\n" + "="*60)
        logger.info("🔍 ТЕСТ: Парсинг страницы editing")
        logger.info("="*60)
        editing_releases = parser.parse_editing_page()
        
        logger.info("\n" + "="*60)
        logger.info("📊 РЕЗУЛЬТАТЫ ТЕСТА:")
        logger.info("="*60)
        logger.info(f"Найдено релизов: {len(editing_releases)}")
        
        if editing_releases:
            logger.info("\n✅ УСПЕХ! Релизы найдены:")
            for i, release in enumerate(editing_releases, 1):
                logger.info(f"  {i}. {release.get('title', 'N/A')} - {release.get('artist', 'N/A')}")
                logger.info(f"     Статус: {release.get('status', 'N/A')}")
                logger.info(f"     UPC: {release.get('upc', 'N/A')}")
        else:
            logger.warning("⚠️ Релизы не найдены!")
        
        return len(editing_releases) > 0
        
    except Exception as e:
        logger.error(f"❌ Ошибка теста: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False
    finally:
        if parser.driver:
            try:
                parser.driver.quit()
                logger.info("🔚 WebDriver закрыт")
            except:
                pass

if __name__ == "__main__":
    success = test_editing_page()
    sys.exit(0 if success else 1)
