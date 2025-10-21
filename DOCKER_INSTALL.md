# 🐳 Установка Docker на Mac

## Шаг 1: Скачать Docker Desktop

Перейдите на официальный сайт:
https://www.docker.com/products/docker-desktop/

Или прямая ссылка для Mac (Apple Silicon):
https://desktop.docker.com/mac/main/arm64/Docker.dmg

Для Intel Mac:
https://desktop.docker.com/mac/main/amd64/Docker.dmg

## Шаг 2: Установка

1. Откройте скачанный `.dmg` файл
2. Перетащите Docker в папку Applications
3. Запустите Docker из Applications
4. Дождитесь запуска (иконка Docker в верхней панели станет активной)

## Шаг 3: Проверка

```bash
docker --version
docker-compose --version
```

Должно вывести что-то вроде:
```
Docker version 24.0.6, build ed223bc
Docker Compose version v2.22.0
```

## Шаг 4: Запуск парсера

```bash
cd /Users/macbook/proga/rossel-music
./scripts/test_parser_docker.sh
```

---

## Альтернатива: Установка через Homebrew

```bash
# Установка Docker
brew install --cask docker

# Запуск Docker
open -a Docker

# Подождите ~30 секунд, пока Docker запустится

# Проверка
docker --version
```

---

## После установки

### 1. Настройка ресурсов (опционально)

Docker Desktop → Settings → Resources:
- **CPUs**: 4+ (рекомендуется)
- **Memory**: 8 GB (рекомендуется)
- **Swap**: 2 GB
- **Disk**: 50 GB+

### 2. Первый запуск парсера

```bash
cd /Users/macbook/proga/rossel-music

# Интерактивный режим
./scripts/test_parser_docker.sh

# Выберите: 3) Пересобрать и запустить
```

### 3. Быстрый запуск (после первой сборки)

```bash
# Только запуск
./scripts/test_parser_docker.sh
# Выберите: 2) Запустить парсер

# Или напрямую
docker-compose -f docker-compose.parser.yml up
```

---

## Troubleshooting

### Docker не запускается

```bash
# Перезапуск Docker
killall Docker && open -a Docker

# Или через GUI
# Закройте Docker полностью и запустите заново
```

### Ошибка "Cannot connect to Docker daemon"

```bash
# Убедитесь что Docker Desktop запущен
open -a Docker

# Подождите 30-60 секунд
docker ps
```

### Медленная работа

В Docker Desktop Settings → Resources увеличьте:
- CPUs до 4-6
- Memory до 8-12 GB

---

## Готово! 🎉

После установки Docker вы сможете:
- ✅ Тестировать Linux парсер локально
- ✅ Не пушить код в GitHub для каждого теста
- ✅ Быстро проверять изменения
- ✅ Отлаживать с прокси

**Следующий шаг:** Запустите `./scripts/test_parser_docker.sh`

