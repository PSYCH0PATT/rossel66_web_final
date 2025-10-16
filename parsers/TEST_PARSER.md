# 🧪 Тестирование Bandlink Parser

## 🎯 Как протестировать парсер

### 1. **Через админскую панель (рекомендуется)**

1. Зайдите на ваш сайт: `http://localhost:3000/dashboard/admin/playlists/parsers`
2. В левой панели выберите артиста (например, "Sour Diesel")
3. Нажмите кнопку **"Парсить Bandlink"**
4. Следите за логами в консоли браузера и терминале

### 2. **Через командную строку**

```bash
cd /Users/macbook/proga/rossel-music
python3 parsers/bandlink_parser_unlocker_linux.py parsers/bandlink_config_unlocker.json
```

## 📊 Что проверять в логах

### ✅ **Успешный запуск:**
```
🔧 Инициализация Bright Data Web Unlocker (PROXY режим)...
🌐 Proxy: brd.superproxy.io:33335
👤 Username: brd-customer-hl_94d02fd9-zone-web_unlocker1...
🔐 Password: ********
✅ Web Unlocker API инициализирован
```

### ✅ **Успешный запрос:**
```
🔍 Поиск артиста: Sour Diesel
🌐 URL поиска: https://band.link/scanner?search=Sour+Diesel
📝 Логика: band.link/scanner?search=Sour+Diesel
🔄 Замена пробелов: 'Sour Diesel' → 'Sour+Diesel'
📤 Запрос #1 через Web Unlocker PROXY
   URL: https://band.link/scanner?search=Sour+Diesel
   Proxy: brd.superproxy.io:33335
   Country: us
📊 Статус ответа: 200
✅ Успешно! Получено HTML: 521030 символов
```

### ✅ **Анализ HTML:**
```
🔍 Анализ полученного HTML:
  - Размер HTML: 521030 символов
  - Содержит 'playlist': True
  - Содержит 'track': True
  - Содержит 'artist': True
  - Содержит 'captcha': False
✅ HTML содержит данные о плейлистах/треках
```

### ❌ **Ошибки proxy:**
```
❌ Ошибка подключения к proxy: [Errno 61] Connection refused
Проверьте правильность username и password для Bright Data
```

### ❌ **Капча не решена:**
```
⚠️ В HTML все еще присутствует капча!
Это может означать, что Web Unlocker API не смог решить капчу
Проверьте логи Bright Data на наличие ошибок
```

## 🔍 Проверка в панели Bright Data

1. Зайдите на [ru-brightdata.com](https://ru-brightdata.com)
2. Перейдите в **Web Unlocker** → **Обзор использования**
3. Вы должны увидеть запросы в реальном времени:
   - URL: `https://band.link/scanner?search=Sour+Diesel`
   - Статус: Success
   - Размер: ~521KB

## 🐛 Отладка проблем

### Проблема: "Connection refused"
**Решение:** Проверьте proxy credentials в конфиге

### Проблема: "Капча не решена"
**Решение:** 
- Проверьте баланс на Bright Data
- Убедитесь, что зона `web_unlocker1` активна
- Попробуйте другой country (ru, de, uk)

### Проблема: "Плейлисты не найдены"
**Решение:**
- Проверьте, есть ли у артиста плейлисты на BandLink
- Убедитесь, что артист существует в системе BandLink
- Проверьте правильность имени артиста

## 📈 Ожидаемые результаты

После успешного парсинга вы должны увидеть:
- ✅ HTML получен (размер > 100KB)
- ✅ Нет капчи в HTML
- ✅ Найдены плейлисты (если они есть у артиста)
- ✅ Данные сохранены в базу `bandlink_playlists_unlocker.db`

## 🎯 Тестовые артисты

Попробуйте с этими артистами:
- "Sour Diesel" - должен работать
- "Wide Pie" - должен работать  
- "PLVT" - должен работать
- "NonExistentArtist" - должен показать "не найден"
