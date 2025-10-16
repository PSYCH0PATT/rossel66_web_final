# 🌐 Настройка Selenium для Residential Proxy Parser

## 📋 Требования

Новая версия парсера использует **Selenium** для работы с динамическим контентом BandLink (JavaScript, AJAX).

---

## 🛠️ Установка

### 1. Установить Selenium

```bash
pip3 install selenium
```

### 2. Установить ChromeDriver

#### **Mac (через Homebrew):**
```bash
brew install chromedriver
```

#### **Linux (Ubuntu/Debian):**
```bash
# Установить Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb

# Установить ChromeDriver
sudo apt-get install chromium-chromedriver
```

#### **Или скачать вручную:**
1. Проверьте версию Chrome: `google-chrome --version`
2. Скачайте соответствующий ChromeDriver: https://chromedriver.chromium.org/downloads
3. Распакуйте и добавьте в PATH

### 3. Проверка установки

```bash
chromedriver --version
```

Должно показать: `ChromeDriver 120.x.x...`

---

## 🚀 Использование

### Запуск через админ-панель:

Всё как раньше - просто выберите артистов и нажмите "Парсить Bandlink"

### Ручной запуск:

```bash
cd /Users/macbook/proga/rossel-music

cat > test_selenium_config.json << EOF
{
  "target_artists": ["Sour Diesel"],
  "bright_data_proxy_username": "brd-customer-hl_94d02fd9-zone-residential_proxy1",
  "bright_data_proxy_password": "juze73q9d91q",
  "proxy_host": "brd.superproxy.io",
  "proxy_port": 33335
}
EOF

python3 parsers/bandlink_parser_residential_selenium.py test_selenium_config.json
```

---

## 🔧 Что изменилось

### ✅ Преимущества Selenium версии:

1. **JavaScript выполняется** - динамический контент загружается
2. **Парсинг по классам** - `card_horizontalContainer`, `card_verticalContainer`
3. **Кнопка "Показать все"** - автоматически нажимается
4. **Прокрутка страницы** - загружаются все плейлисты
5. **Cookies работают** - добавляются в браузер
6. **Residential Proxy** - через Chrome настройки

### ⚠️ Особенности:

- **Медленнее** - реальный браузер работает ~20-30 сек на артиста
- **Больше ресурсов** - ~200MB RAM на процесс Chrome
- **Headless режим** - браузер не виден (работает в фоне)

---

## 🐛 Решение проблем

### "chromedriver not found"

```bash
# Mac
brew install chromedriver

# Linux
sudo apt-get install chromium-chromedriver
```

### "Chrome version mismatch"

Обновите Chrome до последней версии:
```bash
# Mac
brew upgrade google-chrome

# Linux
sudo apt-get update && sudo apt-get upgrade google-chrome-stable
```

### "Permission denied: chromedriver"

```bash
chmod +x /usr/local/bin/chromedriver
```

---

## 📊 Сравнение версий

| Параметр | requests версия | Selenium версия |
|----------|----------------|-----------------|
| Скорость | ⚡ Быстро (~5 сек) | 🐌 Медленно (~25 сек) |
| JavaScript | ❌ Нет | ✅ Да |
| Динамический контент | ❌ Нет | ✅ Да |
| Парсинг по классам | ❌ Не работает | ✅ Работает |
| Ресурсы | 💚 Мало (~50MB) | 💛 Средне (~200MB) |
| Надежность | ⚠️  Капча часто | ✅ Меньше капчи |

---

## 🎯 Рекомендация

**Используйте Selenium версию** - она правильно работает с динамическим контентом BandLink и находит плейлисты.

---

📖 **Назад к основной документации:** [RESIDENTIAL_PROXY_SETUP.md](RESIDENTIAL_PROXY_SETUP.md)

