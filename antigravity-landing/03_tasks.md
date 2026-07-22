# Tasks: ROSSEL 66 MUSIC — Animated Landing Page 2026

## Objective
Build a world-class animated landing page for ROSSEL 66 MUSIC, a Russian independent music label. The page must feel premium, cinematic, and contemporary — matching the aesthetic quality of sites like twinbru.com, jasminegunarto.com, and oryzo.ai.

## Tech Stack
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS + CSS custom properties
- **Animations:** GSAP (ScrollTrigger, SplitText) + Framer Motion
- **Smooth Scroll:** Lenis
- **Fonts:** Space Grotesk (display) + Inter (body) — via Google Fonts

## Design System

### Colors
```
--bg-primary: #050505
--bg-secondary: #0d0d0d
--accent-emerald: #00C957       /* фирменный изумрудный лейбла */
--accent-emerald-muted: #10b981 /* приглушённый изумрудный */
--accent-azure: #0ea5e9         /* фирменный лазурный лейбла */
--accent-cyan: #00CCCC          /* насыщенный циановый */
--text-primary: #F5F5F0
--text-muted: #666666
--border: rgba(255,255,255,0.08)
--border-emerald: rgba(0,201,87,0.25)
--border-azure: rgba(14,165,233,0.25)
```

### Typography — ВАЖНО
Шрифты должны быть **строгие и геометричные**. Использовать те же шрифты что в личном кабинете лейбла:

- **Display/Заголовки (h1, section titles):** `Syncopate` — кастомный шрифт лейбла.  
  Файл: `SyncopateRus.ttf` (поддерживает кириллицу).  
  Скопировать из `/public/fonts/SyncopateRus.ttf` исходного проекта.  
  Характер: геометрический, строгий, всегда uppercase, letter-spacing широкий.
- **Body/UI:** `Nunito Sans` (Google Fonts) — весь остальной текст.

```
Hero headline:    Syncopate, 700, uppercase, clamp(3rem, 10vw, 12rem), letter-spacing: 0.05em
Section titles:   Syncopate, 700, uppercase, clamp(2rem, 5vw, 5rem), letter-spacing: 0.08em
Subheadings:      Nunito Sans, 600, 1.25rem–1.5rem
Body:             Nunito Sans, 400, 1rem, line-height 1.65
Labels/eyebrow:   Nunito Sans, 600, 0.75rem, uppercase, letter-spacing: 0.25em
```

### Animation Principles
- All scroll animations use GSAP ScrollTrigger
- Elements enter from opacity:0 + y:40px
- Duration: 0.8s, ease: "power2.out"
- Stagger children: 0.1s
- Smooth scroll via Lenis (lerp: 0.1)

### Accent Usage
- Emerald `#00C957`: CTA кнопки, активные элементы, hover borders на карточках артистов, submit кнопка формы
- Azure `#0ea5e9`: иконки услуг, ссылки, вторичные акценты, badges
- Оба цвета можно использовать вместе как gradient: `linear-gradient(135deg, #00C957, #0ea5e9)`

## Sections (in order)

### 1. Navbar
- Transparent → blurs on scroll
- Logo: "ROSSEL 66 MUSIC" text mark — Syncopate font, uppercase
- Nav links: Достижения | Услуги | Партнеры | Артисты | Контакты
- CTA button: "Отправить заявку" (emerald accent: border #00C957, text #00C957, hover → fill #00C957 bg)
- Hamburger menu for mobile

### 2. Hero (fullscreen)
- Fullscreen (100vh) dark background
- Giant kinetic headline: "ROSSEL 66 MUSIC"
- Subtext: "Деловые отношения, дружеская атмосфера"
- Background: subtle animated grain texture overlay
- Subtle background: slow-moving gradient orbs (purple + gold, very low opacity)
- Scroll indicator: animated downward arrow
- CTA: "Отправить заявку" button

### 3. Stats / Достижения
- Section title: "Наши достижения"
- 4 stat cards with animated count-up numbers:
  1. "Свыше 500 000" — ежедневного стриминга на всех площадках
  2. "Большой опыт" — в продвижении молодых талантов с новым звуком
  3. "Музыкальное сообщество" — Откроем двери в профессиональное творческое окружение
  4. "Коммерческий образ" — Сформируем сильный и узнаваемый имидж артиста
- Cards appear with stagger on scroll

### 4. Services / Услуги
- Section title: "Мы займёмся вашим продвижением!"
- Horizontal scroll on desktop OR sticky scroll stack
- 6 service cards:
  1. Промо — Покажем ваш трек редакторам цифровых платформ
  2. Таргетинг/посевы — Оставьте на нас продвижение вашей музыки
  3. Выступления — Организуем концерты, клабшоу и другие события
  4. SMM — Продвижение через соцсети и рост вовлечённости
  5. Продакшн — Съёмки клипов, фотосессии, помощь в оформлении соцсетей
  6. Менеджмент — Возьмём на себя организацию всех процессов

### 5. Partners / Партнёры
- Section title: "Наши партнеры"
- Infinite marquee / ticker tape with platform names:
  Spotify, Apple Music, YouTube Music, VK, Yandex Music, Zvuk, Amazon Music, Deezer, TikTok, Instagram
- Second row (reversed direction):
  Believe Distribution Services, Zvonko Digital, Soyuz Music, MA Music, MH Music, Koala Music
- Subtitle: "Наши партнеры обеспечивают широкий охват аудитории и максимальное продвижение вашей музыки на всех ключевых площадках"

### 6. Artists / Артисты
- Section title: "Наши артисты"
- Subtitle: "Мы гордимся нашими талантливыми артистами, которые уже добились успеха с нашей поддержкой"
- 4 artist cards (3 real + 1 CTA):
  1. WIDE PIE — Релиз "blurred" собрал более 200к прослушиваний в первую неделю. Метка: "Активный артист"
  2. PLVT — Более 1 500 000 прослушиваний на треке "like you". Метка: "Активный артист"
  3. Sour Diesel — Более 1 000 000 прослушиваний на треке "Воспоминания". Метка: "Активный артист"
  4. CTA card — "Здесь можешь быть ты!" / "Заполни форму ниже и стань частью нашей команды". Метка: "Присоединяйся к нам"

### 7. Contact Form / Заявка
- Section title: "Отправить заявку"
- Subtitle: "Заполните форму ниже, и мы свяжемся с вами для обсуждения сотрудничества"
- Fields:
  - Никнейм (placeholder: "Ваш творческий псевдоним")
  - Телеграм для связи (placeholder: "@username")
  - Немного о себе (placeholder: "Расскажите о своем творчестве, достижениях и целях")
- Submit button: "Отправить заявку"
- Success state: "Спасибо за заявку! Мы рассмотрим вашу заявку и свяжемся с вами в ближайшее время."

### 8. Footer
- Brand: "ROSSEL 66 MUSIC" + слоган
- Contacts: label@rossel66.com
- Socials: VK (https://vk.com/rossel66) | Telegram (https://t.me/rossel66)
- Copyright: © 2026 ROSSEL 66 MUSIC. Все права защищены.

## Global Features
- [ ] Custom cursor (magnetic, changes on hover over links)
- [ ] Grain texture overlay on entire page (subtle, 3–5% opacity)
- [ ] Scroll progress indicator (thin line at top)
- [ ] Page enter animation (black overlay fades out on load)

## Roadmap

- [ ] **Setup**: Init Vite + React + TypeScript project
- [ ] **Dependencies**: Install GSAP, Framer Motion, Lenis, Tailwind
- [ ] **Design tokens**: Set up CSS variables and Tailwind config
- [ ] **Global**: Layout wrapper, fonts, grain overlay, custom cursor, Lenis init
- [ ] **Navbar**: Transparent sticky with blur-on-scroll
- [ ] **Hero**: Fullscreen kinetic typography hero
- [ ] **Stats**: Animated count-up cards
- [ ] **Services**: Horizontal scroll or sticky stack section
- [ ] **Partners**: Infinite marquee
- [ ] **Artists**: Artist cards grid
- [ ] **Contact**: Form with validation
- [ ] **Footer**: Links and brand
- [ ] **Animations**: GSAP ScrollTrigger pass on all sections
- [ ] **Mobile**: Responsive breakpoints
- [ ] **Build**: Production build + export
