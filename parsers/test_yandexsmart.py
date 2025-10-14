#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовый скрипт для проверки доступности метода yandexSmart в 2captcha-python
"""

import sys

print("="*60)
print("🧪 Тест доступности метода yandexSmart")
print("="*60)

# Проверка 1: Импорт библиотеки
print("\n1️⃣ Проверка импорта 2captcha-python...")
try:
    from twocaptcha import TwoCaptcha
    print("✅ Библиотека 2captcha-python установлена")
except ImportError:
    print("❌ Библиотека 2captcha-python НЕ установлена!")
    print("💡 Установите: pip install 2captcha-python")
    sys.exit(1)

# Проверка 2: Создание экземпляра
print("\n2️⃣ Создание экземпляра TwoCaptcha...")
try:
    solver = TwoCaptcha("test_api_key")
    print("✅ Экземпляр создан")
except Exception as e:
    print(f"❌ Ошибка создания экземпляра: {e}")
    sys.exit(1)

# Проверка 3: Наличие метода yandexSmart
print("\n3️⃣ Проверка наличия метода yandexSmart...")
if hasattr(solver, 'yandexSmart'):
    print("✅ Метод yandexSmart ДОСТУПЕН!")
    print("🎉 Вы можете использовать безопасную версию парсера!")
else:
    print("❌ Метод yandexSmart НЕ ДОСТУПЕН!")
    print("\n💡 Возможные решения:")
    print("   1. Обновите библиотеку: pip install --upgrade 2captcha-python")
    print("   2. Используйте библиотеку 2captcha-ts (Node.js)")
    print("   3. Переключитесь на Anti-Captcha")

# Проверка 4: Список доступных методов
print("\n4️⃣ Доступные методы в TwoCaptcha:")
methods = [method for method in dir(solver) if not method.startswith('_')]
for method in methods:
    print(f"   - {method}")

print("\n" + "="*60)
print("🔍 Результаты теста:")
print("="*60)

if hasattr(solver, 'yandexSmart'):
    print("✅ Метод yandexSmart доступен - можно использовать безопасный парсер")
else:
    print("❌ Метод yandexSmart недоступен - нужны альтернативные решения")
    print("\n📋 Рекомендации:")
    print("1. Проверьте версию 2captcha-python: pip show 2captcha-python")
    print("2. Обновите до последней версии: pip install --upgrade 2captcha-python")
    print("3. Если не помогло - используйте Anti-Captcha или 2captcha-ts")

print("\n" + "="*60)

