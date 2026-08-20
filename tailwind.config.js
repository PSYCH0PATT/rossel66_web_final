/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /**
         * Тёмные поверхности кабинета (этап 2.1, причины C-04/C-05).
         * Значения — в `app/tokens.css`, здесь только имена утилит.
         * `<alpha-value>` сохраняет модификатор прозрачности: `bg-surface-raised/60`
         * даёт ровно то же, что нынешний `bg-[#141414]/60`.
         */
        surface: {
          page: "rgb(var(--surface-page) / <alpha-value>)",
          dialog: "rgb(var(--surface-dialog) / <alpha-value>)",
          "dialog-blue": "rgb(var(--surface-dialog-blue) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--surface-overlay) / <alpha-value>)",
          field: "rgb(var(--surface-field) / <alpha-value>)",
          hover: "rgb(var(--surface-hover) / <alpha-value>)",
          glass: "rgb(var(--surface-glass) / <alpha-value>)",
        },
        /** Акценты кабинета. NB: `brand` (#10b981) ≠ `primary` (тема shadcn). */
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          azure: "rgb(var(--brand-azure) / <alpha-value>)",
          purple: "rgb(var(--brand-purple) / <alpha-value>)",
          "purple-fg": "rgb(var(--brand-purple-fg) / <alpha-value>)",
          cyan: "rgb(var(--brand-cyan) / <alpha-value>)",
        },
        /** Статусы: значения = текущим, семантика зафиксирована. */
        status: {
          success: "rgb(var(--status-success) / <alpha-value>)",
          info: "rgb(var(--status-info) / <alpha-value>)",
          warning: "rgb(var(--status-warning) / <alpha-value>)",
          moderation: "rgb(var(--status-moderation) / <alpha-value>)",
          danger: "rgb(var(--status-danger) / <alpha-value>)",
          neutral: "rgb(var(--status-neutral) / <alpha-value>)",
        },
        /**
         * Легаси-палитра финансового дашборда (`azure` #00FFFF, `emerald`
         * #00C957) удалена в волне 4.4 вместе с последними носителями —
         * страницами `artists/[id]/{payments,releases}`. Раньше по той же
         * причине ушли `category.*`, `background-light`, `background-dark`,
         * `glass-dark`, `glass-light`. NB: числовая шкала `emerald-400/500`
         * приходит из палитры Tailwind и никуда не девалась.
         */
        // Фоновые блобы шелла кабинета (app/dashboard/layout.tsx).
        "accent-azure": "rgb(var(--brand-azure) / <alpha-value>)", // #0ea5e9, Sky 500
        "accent-emerald": "rgb(var(--brand) / <alpha-value>)", // #10b981, Emerald 500
      },
      fontFamily: {
        // ALL body/UI text — Nunito Sans (full Cyrillic)
        sans: ["var(--font-nunito-sans)", "sans-serif"],
        body: ["var(--font-nunito-sans)", "sans-serif"],
        mono: ["var(--font-nunito-sans)", "sans-serif"],
        "card-heading": ["var(--font-nunito-sans)", "sans-serif"],
        "card-label": ["var(--font-nunito-sans)", "sans-serif"],
        // ONLY for h1 section headings
        display: ["var(--font-syncopate)", "sans-serif"],
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        pulse: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: .5 }
        },
        "pulse-azure-blob": {
          "0%, 100%": { opacity: 0.7 },
          "50%": { opacity: 0.4 },
        },
        /**
         * Появление экрана логина. Волна 4.4: раньше эти четыре анимации жили
         * в `styled-jsx`-блоке самой страницы и переопределяли глобальный
         * `.animate-float` из globals.css. Имена с префиксом `login-` — чтобы
         * не спорить с ним снова.
         */
        "login-fade-down": {
          from: { opacity: 0, transform: "translateY(-20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "login-fade-up": {
          from: { opacity: 0, transform: "translateY(20px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "login-fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "login-float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        "pulse-slow-azure-blob":
          "pulse-azure-blob 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "login-fade-down": "login-fade-down 0.8s ease-out",
        "login-fade-up": "login-fade-up 0.8s ease-out 0.2s backwards",
        "login-fade-in": "login-fade-in 0.8s ease-out 0.4s backwards",
        "login-float": "login-float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    /**
     * A11y-3: вариант `pointer-coarse:` (сенсорный ввод). В Tailwind 3 его нет —
     * появился только в v4. Нужен, чтобы поднимать тач-таргеты до 44px на
     * телефонах/планшетах, не меняя плотность вёрстки под мышью.
     */
    function ({ addVariant }) {
      addVariant("pointer-coarse", "@media (pointer: coarse)")
      addVariant("pointer-fine", "@media (pointer: fine)")
    },
  ],
} 