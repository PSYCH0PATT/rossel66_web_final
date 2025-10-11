#!/bin/bash

# Скрипт для быстрого запуска Mac-тестирования Bandlink Parser

echo "🍎 Mac Test Environment для Bandlink Parser"
echo "=============================================="

# Проверяем, что мы в правильной папке
if [ ! -f "bandlink_parser_mac.py" ]; then
    echo "❌ Файл bandlink_parser_mac.py не найден!"
    echo "💡 Запустите скрипт из папки parsers/"
    exit 1
fi

# Активируем виртуальное окружение
echo "🔧 Активация виртуального окружения..."
source mac_test_env/bin/activate

# Проверяем зависимости
echo "🔍 Проверка зависимостей..."
python3 -c "import selenium; from twocaptcha import TwoCaptcha; print('✅ Зависимости OK')" || {
    echo "❌ Зависимости не установлены!"
    echo "💡 Установите: pip install -r requirements_mac.txt"
    exit 1
}

# Запускаем тест
echo "🚀 Запуск теста..."
python3 run_mac_test.py

echo "=============================================="
echo "🎉 Тест завершен!"
