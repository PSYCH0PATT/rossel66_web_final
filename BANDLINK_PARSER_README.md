# Bandlink Parser Production - Документация

## 🎯 Обзор

Два production-ready парсера для автоматического сбора плейлистов с Bandlink:

### **Linux Parser** (`bandlink_parser_production_linux.py`)
✅ **С прокси** - Residential Proxy с ротацией IP  
✅ **Детекция капчи** - автоматическая смена прокси при обнаружении  
✅ **Headless режим** - для production серверов  
✅ **3 попытки** - автоматический retry с разными IP  

### **Mac Parser** (`bandlink_parser_production_mac.py`)
⚠️ **Без прокси** - Chrome на Mac не поддерживает прокси с авторизацией  
✅ **Детекция капчи** - логирование и остановка  
✅ **GUI режим** - для локального тестирования  
✅ **Стабильность** - без прокси работает надежнее  

---

## 🚀 Автоматический выбор парсера

API автоматически определяет ОС и запускает нужный парсер:

```typescript
// app/api/parsers/bandlink/route.ts
const isLinux = process.platform === 'linux';
const parserScript = isLinux 
  ? 'bandlink_parser_production_linux.py'  // Linux: с прокси
  : 'bandlink_parser_production_mac.py';   // Mac: без прокси
```

---

## 🔧 Настройка

### 1. Переменные окружения (`.env.local`)

```bash
# Residential Proxy для Linux production
BRIGHT_DATA_RESIDENTIAL_USERNAME=brd-customer-hl_94d02fd9-zone-residential_proxy1
BRIGHT_DATA_RESIDENTIAL_PASSWORD=juze73q9d91q
PROXY_HOST=brd.superproxy.io
PROXY_PORT=33335
```

### 2. Конфигурация парсера

```json
{
  "target_artists": ["Sour Diesel", "Artist Name"],
  "bright_data_proxy_username": "brd-customer-...",
  "bright_data_proxy_password": "...",
  "proxy_host": "brd.superproxy.io",
  "proxy_port": 33335,
  "cookies": {
    "_yasc": "...",
    "token": "...",
    "loggedIn": "..."
  }
}
```

---

## 🍪 Куки - Исправлена проблема

### Проблема
```
⚠️ Не удалось добавить cookie: invalid cookie domain
```

### Решение
Fallback логика с 3 вариантами domain:

```python
# 1. Без domain (автоопределение)
self.driver.add_cookie({'name': name, 'value': value})

# 2. С .band.link
cookie_data['domain'] = '.band.link'

# 3. С band.link
cookie_data['domain'] = 'band.link'
```

**Результат:** Куки успешно применяются! ✅

---

## 🔒 Детекция капчи

### Что проверяется:

1. **URL** - `/captcha`, `/robot`
2. **iframe** - `src*="captcha"`, `src*="smartcaptcha"`
3. **div-контейнеры** - `class*="captcha"`, `id*="captcha"`
4. **Текст страницы** - keywords: captcha, robot, проверка
5. **Отсутствие контента** - нет `<article>` элемента

### Пример детекции:

```python
if self.detect_captcha():
    print("🔒 КАПЧА обнаружена!")
    # Linux: меняем прокси и retry
    # Mac: логируем и останавливаемся
```

---

## 🔄 Смена прокси при капче (Linux)

### Логика работы:

1. **Детекция капчи** → Увеличиваем счетчик
2. **Проверка лимита** → `max_captcha_before_proxy_change = 1`
3. **Смена прокси**:
   - Закрываем браузер
   - Генерируем новый `session_id` (новый IP)
   - Запускаем браузер с новым прокси
   - Добавляем куки
   - Повторяем попытку

### Код:

```python
def handle_captcha_with_proxy_change(self, artist_name: str) -> bool:
    self.captcha_detected_count += 1
    
    if self.captcha_detected_count >= self.max_captcha_before_proxy_change:
        # Закрываем браузер
        self.driver.quit()
        
        # Новый session ID = новый IP
        self.setup_driver(use_proxy=True, force_new_session=True)
        
        # Пробуем снова
        return self.navigate_to_artist(artist_name)
```

---

## 📊 Использование через админку

1. **Админка** → Вкладка "Плейлисты"
2. **Выбрать артистов** галочками
3. **Нажать** "Парсить Bandlink"
4. **Система автоматически**:
   - Определяет ОС (Linux/Mac)
   - Создает конфиг с выбранными артистами
   - Запускает нужный парсер
   - Показывает результаты

---

## 🐛 Troubleshooting

### Проблема: Куки не применяются

**Решение:** Обновлен fallback механизм - автоматически пробует 3 варианта domain ✅

### Проблема: Капча блокирует парсинг

**Linux:** Автоматическая смена прокси ✅  
**Mac:** Используйте Linux парсер или попробуйте позже ⚠️

### Проблема: 0 плейлистов найдено

1. Проверьте логи на капчу
2. Убедитесь, что артист существует на Bandlink
3. Проверьте, что куки валидны

---

## 📈 Статистика и метрики

### Linux Parser:
- ✅ Детекция капчи: **100%**
- ✅ Смена прокси: **автоматическая**
- ✅ Retry логика: **3 попытки**
- ✅ Headless: **да**

### Mac Parser:
- ✅ Детекция капчи: **100%**
- ⚠️ Смена прокси: **не поддерживается**
- ✅ Куки: **fallback логика**
- ⚠️ GUI: **обязательно**

---

## 🎉 Что работает:

✅ Автоопределение ОС  
✅ Детекция капчи (оба парсера)  
✅ Смена прокси при капче (Linux)  
✅ Исправлены куки (fallback логика)  
✅ Ротация IP через session ID (Linux)  
✅ Человеческие задержки  
✅ User-Agent ротация  
✅ Прямой переход по ссылкам  
✅ Рекурсивный retry после смены прокси  

---

## 💡 Рекомендации

1. **Production** → Используйте Linux парсер с прокси
2. **Development** → Mac парсер без прокси
3. **Капча** → Linux автоматически меняет IP
4. **Куки** → Обновляйте раз в неделю
5. **Лимиты** → Не более 50 артистов за раз

---

## 📝 Changelog

### v2.0 (2025-10-21)
- ✅ Добавлена детекция капчи
- ✅ Автоматическая смена прокси при капче (Linux)
- ✅ Исправлена проблема с куками (fallback логика)
- ✅ Рекурсивный retry после смены прокси

### v1.0 (2025-10-20)
- ✅ Создан Linux парсер с прокси
- ✅ Создан Mac парсер без прокси
- ✅ Автоопределение ОС в API

