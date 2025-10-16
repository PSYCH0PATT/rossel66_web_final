# 🔍 ИНСТРУКЦИЯ ПО ПОИСКУ SITEKEY

## Автоматические методы (в скрипте):

### ✅ Метод 1: Атрибут data-sitekey
Ищет `data-sitekey` в HTML элементах

### ✅ Метод 2: Sitekey в src iframe
Ищет `sitekey=...` в URL iframe

### ✅ Метод 3: Regex поиск в HTML
Ищет различные варианты написания sitekey в HTML коде

### ✅ Метод 4: JavaScript переменные
Проверяет `window.__SSR_DATA__`, `window.smartCaptcha` и т.д.

### ✅ Метод 5: Meta теги
Ищет sitekey в meta тегах

### ✅ Метод 6: LocalStorage/SessionStorage
Проверяет browser storage

### ✅ Метод 7: Cookies
Проверяет cookies

---

## Ручные методы (для вас):

### 🔧 Метод 8: Network вкладка (ВАЖНО!)

1. **Откройте DevTools** (F12)
2. **Перейдите на вкладку Network**
3. **Обновите страницу** (Ctrl+R или F5)
4. **Ищите запросы к:**
   - `captcha-api.yandex.ru`
   - `smartcaptcha`
   - `yandex.ru/captcha`

5. **Проверьте каждый запрос:**
   - **Headers tab** - ищите `X-Sitekey`, `X-Key`, или подобное
   - **Payload tab** - ищите `sitekey` в отправленных данных
   - **Preview/Response tab** - ищите `sitekey` в ответе

### 🔧 Метод 9: Console JavaScript

1. **Откройте DevTools** (F12)
2. **Перейдите на вкладку Console**
3. **Введите команды:**

```javascript
// Проверка window.__SSR_DATA__
console.log(window.__SSR_DATA__);

// Проверка всех window переменных
Object.keys(window).filter(k => k.includes('captcha') || k.includes('key'));

// Поиск в document
document.querySelector('[data-sitekey]')?.getAttribute('data-sitekey');

// Поиск во всех iframe
Array.from(document.querySelectorAll('iframe')).map(iframe => ({
  src: iframe.src,
  sitekey: new URL(iframe.src).searchParams.get('sitekey')
}));

// Глубокий поиск
document.documentElement.innerHTML.match(/sitekey['":\s=]+([a-zA-Z0-9_\-]+)/gi);
```

### 🔧 Метод 10: Elements tab

1. **Откройте DevTools** (F12)
2. **Перейдите на вкладку Elements**
3. **Нажмите Ctrl+F** (поиск в HTML)
4. **Ищите:**
   - `sitekey`
   - `data-sitekey`
   - `captchaKey`
   - `ysc1_` (обычное начало sitekey)

### 🔧 Метод 11: Sources tab

1. **Откройте DevTools** (F12)
2. **Перейдите на вкладку Sources**
3. **Откройте файлы JavaScript**
4. **Нажмите Ctrl+Shift+F** (глобальный поиск)
5. **Ищите:** `sitekey`, `captchaKey`, `smartCaptcha`

---

## Что делать после того, как найдете:

### Если найден `sitekey`:
```
Скопируйте значение и скажите мне:
- Где нашли (метод)
- Какое значение (первые 20 символов)
- В каком формате (строка, объект, URL параметр)
```

### Если НЕ найден `sitekey`:
```
1. Проверьте, что вы на СТРАНИЦЕ С КАПЧЕЙ (showcaptcha)
2. Сделайте скриншот DevTools → Network
3. Сделайте скриншот Console с выводом window.__SSR_DATA__
4. Покажите мне HTML первых 2000 символов (View Page Source)
```

---

## 📝 Как запустить скрипт:

```bash
cd /Users/macbook/proga/rossel-music
source test_env/bin/activate
python3 parsers/sitekey_finder.py 'https://band.link/showcaptcha?...'
```

**Замените URL на ваш URL страницы с капчей!**


