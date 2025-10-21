# 🐳 Docker для тестирования Bandlink Parser

## Быстрый старт

### Способ 1: Через скрипт (рекомендуется)

```bash
./scripts/test_parser_docker.sh
```

Выберите опцию:
1. **Собрать образ** - первый раз
2. **Запустить парсер** - запуск с текущим конфигом
3. **Пересобрать и запустить** - после изменения кода
4. **Открыть shell** - для отладки
5. **Посмотреть логи** - реал-тайм логи
6. **Остановить контейнеры** - очистка

---

### Способ 2: Через docker-compose

```bash
# Собрать и запустить
docker-compose -f docker-compose.parser.yml up --build

# Только запустить
docker-compose -f docker-compose.parser.yml up

# В фоне
docker-compose -f docker-compose.parser.yml up -d

# Остановить
docker-compose -f docker-compose.parser.yml down
```

---

### Способ 3: Через docker напрямую

```bash
# Собрать образ
docker build -f Dockerfile.parser -t bandlink-parser .

# Запустить
docker run -it --rm \
  -v $(pwd)/parsers:/app/parsers \
  -v $(pwd)/temp_bandlink_config.json:/app/temp_bandlink_config.json \
  -v $(pwd)/bandlink_playlists.db:/app/bandlink_playlists.db \
  --shm-size=2g \
  bandlink-parser

# Shell для отладки
docker run -it --rm \
  -v $(pwd)/parsers:/app/parsers \
  --shm-size=2g \
  bandlink-parser /bin/bash
```

---

## 🔧 Настройка

### Переменные окружения

Отредактируйте `docker-compose.parser.yml`:

```yaml
environment:
  - BRIGHT_DATA_RESIDENTIAL_USERNAME=your-username
  - BRIGHT_DATA_RESIDENTIAL_PASSWORD=your-password
  - PROXY_HOST=brd.superproxy.io
  - PROXY_PORT=33335
```

Или создайте `.env` файл:

```bash
BRIGHT_DATA_RESIDENTIAL_USERNAME=brd-customer-hl_94d02fd9-zone-residential_proxy1
BRIGHT_DATA_RESIDENTIAL_PASSWORD=juze73q9d91q
PROXY_HOST=brd.superproxy.io
PROXY_PORT=33335
```

---

## 🐛 Отладка

### Открыть shell в контейнере

```bash
docker-compose -f docker-compose.parser.yml run --rm bandlink-parser /bin/bash
```

Внутри контейнера:

```bash
# Проверить Python
python3 --version

# Проверить Selenium
python3 -c "import selenium; print(selenium.__version__)"

# Проверить Chrome
google-chrome --version

# Запустить парсер вручную
python3 parsers/bandlink_parser_production_linux.py temp_bandlink_config.json
```

### Просмотр логов

```bash
# Реал-тайм
docker-compose -f docker-compose.parser.yml logs -f

# Последние 100 строк
docker-compose -f docker-compose.parser.yml logs --tail=100
```

### Проверка БД

```bash
# В контейнере
sqlite3 bandlink_playlists.db "SELECT * FROM playlists;"

# С хоста (если БД в volume)
sqlite3 bandlink_playlists.db "SELECT COUNT(*) FROM playlists;"
```

---

## 📊 Что включено

- ✅ **Python 3.11** - последняя версия
- ✅ **Chrome Stable** - актуальная версия для Linux
- ✅ **ChromeDriver** - автоматическое управление через webdriver-manager
- ✅ **Selenium** - для автоматизации браузера
- ✅ **SQLite3** - для работы с БД
- ✅ **Headless режим** - без GUI
- ✅ **Прокси поддержка** - Residential Proxy
- ✅ **Volumes** - изменения кода сразу видны

---

## 🚀 Преимущества Docker

### Зачем использовать Docker?

1. **Точная среда Linux** - тестируете то же, что и на production
2. **Без пуша в GitHub** - изменения сразу тестируются
3. **Без билда Next.js** - только парсер
4. **Изоляция** - не засоряет систему
5. **Быстрый запуск** - 2-3 секунды после сборки
6. **Легко отлаживать** - shell доступ

### Workflow разработки:

```bash
# 1. Меняете код в parsers/bandlink_parser_production_linux.py
# 2. Запускаете
./scripts/test_parser_docker.sh
# Выбираете опцию 2 (если образ собран) или 3 (если нужна пересборка)
# 3. Смотрите результаты
# 4. Повторяете
```

---

## ⚠️ Важные моменты

### Shared Memory

Chrome в headless режиме требует больше памяти:

```yaml
shm_size: '2gb'
```

Если ошибка `session not created`, увеличьте до `4gb`.

### Volumes

Файлы синхронизируются автоматически:

- `./parsers` → `/app/parsers` - код парсера
- `./temp_bandlink_config.json` → конфиг
- `./bandlink_playlists.db` → БД

Изменения на хосте сразу видны в контейнере!

### Остановка контейнеров

```bash
# Graceful shutdown
docker-compose -f docker-compose.parser.yml down

# Force kill (если зависло)
docker-compose -f docker-compose.parser.yml kill
docker-compose -f docker-compose.parser.yml rm -f
```

---

## 🔍 Типичные проблемы

### "Docker daemon not running"

```bash
# Mac
open -a Docker

# Или установите Docker Desktop
```

### "Permission denied"

```bash
# Дайте права скрипту
chmod +x scripts/test_parser_docker.sh
```

### "No space left on device"

```bash
# Очистка старых образов
docker system prune -a

# Очистка volumes
docker volume prune
```

### Парсер не запускается

```bash
# Проверьте логи
docker-compose -f docker-compose.parser.yml logs

# Зайдите в shell и запустите вручную
docker-compose -f docker-compose.parser.yml run --rm bandlink-parser /bin/bash
python3 parsers/bandlink_parser_production_linux.py temp_bandlink_config.json
```

---

## 📝 Примеры

### Тестирование с разными артистами

```bash
# 1. Отредактируйте temp_bandlink_config.json
# 2. Запустите
docker-compose -f docker-compose.parser.yml up

# Результаты в bandlink_playlists.db
```

### Тестирование капчи

```bash
# Запустите парсер несколько раз подряд
for i in {1..5}; do
  echo "Попытка $i"
  docker-compose -f docker-compose.parser.yml up
  sleep 5
done
```

### Проверка прокси

```bash
# В shell контейнера
docker-compose -f docker-compose.parser.yml run --rm bandlink-parser /bin/bash

# Проверка прокси
curl -x http://USER:PASS@brd.superproxy.io:33335 https://lumtest.com/myip.json
```

---

## 🎯 Сравнение: Mac vs Docker Linux

| Функция | Mac | Docker Linux |
|---------|-----|--------------|
| Прокси | ❌ Не работают | ✅ Работают |
| Headless | ⚠️ Проблемы | ✅ Стабильно |
| Смена IP | ❌ | ✅ Автоматически |
| Скорость | 🐌 Медленнее | 🚀 Быстрее |
| Стабильность | ⚠️ Средняя | ✅ Высокая |

**Вывод:** Используйте Docker для финального тестирования перед деплоем!

---

## 🔐 Безопасность

### Не коммитьте credentials!

`.dockerignore` и `.gitignore` уже настроены, но:

```bash
# Проверьте перед коммитом
git status
git diff

# Никогда не коммитьте:
# - temp_bandlink_config.json с реальными credentials
# - .env файлы
# - bandlink_playlists.db
```

---

## 📚 Дополнительно

### Мониторинг ресурсов

```bash
# Использование CPU/RAM
docker stats

# Размер образов
docker images
```

### Очистка

```bash
# Удалить все остановленные контейнеры
docker container prune

# Удалить неиспользуемые образы
docker image prune -a

# Удалить все (осторожно!)
docker system prune -a --volumes
```

---

**Готово к тестированию! 🚀**

