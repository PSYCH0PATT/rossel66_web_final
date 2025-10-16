# ⚡ Быстрый старт: Residential Proxy Parser

## 🚀 За 3 шага

### 1️⃣ Инициализация БД

```bash
cd /Users/macbook/proga/rossel-music
python3 parsers/init_cookies_db.py
```

### 2️⃣ Обновление cookies

1. Откройте https://band.link в браузере
2. Откройте DevTools (F12) → Network
3. Скопируйте любой запрос как curl (Copy → Copy as cURL)
4. Вставьте в админ-панель: http://localhost:3000/dashboard/admin/playlists → вкладка "Парсинг" → колонка "Cookies Bandlink"
5. Нажмите "Обновить Cookies"

### 3️⃣ Настройка автоматического запуска

```bash
./scripts/setup_bandlink_cron.sh
```

**Готово! ✨**

---

## 📅 Расписание

Парсинг запускается автоматически:
- 🕐 Пн: 14:00
- 🕐 Пт: 00:15, 18:00
- 🕐 Сб: 00:15, 18:00
- 🕐 Вс: 00:15, 18:00

---

## 🔧 Ручной запуск

Через админ-панель:
1. http://localhost:3000/dashboard/admin/playlists
2. Выберите артистов
3. "Парсить Bandlink"

---

## 📊 Мониторинг

### Статус БД:
```bash
python3 parsers/init_cookies_db.py --status
```

### Логи:
```bash
tail -f logs/scheduled_bandlink.log
```

### Уведомления:
Если появится "⚠️ Требуются новые cookies!" - повторите шаг 2️⃣

---

## 💰 Стоимость

~**10₽/месяц** для 5 парсингов в неделю

---

📖 **Подробная документация:** [RESIDENTIAL_PROXY_SETUP.md](RESIDENTIAL_PROXY_SETUP.md)

