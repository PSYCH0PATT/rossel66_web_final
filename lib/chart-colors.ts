/**
 * Палитра графиков кабинета — этап 2.1 UI-overhaul (причина C-04).
 *
 * Цвета серий и тултипов задаются через inline-`style` и пропсы recharts,
 * поэтому классом Tailwind их не выразить: нужна JS-константа. До этого
 * палитра была скопирована в четырёх местах (`SOURCE_COLORS` в аналитике
 * админа и артиста, `DSP_COLORS` в DspStreamChart, `BAR_COLORS` там же),
 * и любая правка цвета требовала обхода всех копий.
 *
 * ЗНАЧЕНИЯ = ТЕКУЩИМ. Модуль создан на этапе 2.1, но по страницам НЕ
 * применяется — подстановка идёт волнами этапа 4 (docs/ui-audit.md).
 * В комментариях указано, откуда взято значение, чтобы подстановка была
 * механической и пиксель в пиксель.
 *
 * Хексы совпадают с палитрой Tailwind (emerald-500, blue-500, …) — там, где
 * место позволяет класс, используйте класс или токен из `app/tokens.css`,
 * а не эти константы.
 */

/**
 * Серии круговых/столбчатых разбивок: «стримы по источникам», «по площадкам».
 * Дословно `SOURCE_COLORS` из `app/dashboard/admin/analytics/page.tsx:42`
 * и `app/dashboard/artist/[username]/analytics/page.tsx:19`.
 */
export const CHART_SERIES_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
] as const

/**
 * Линии графика стримов по DSP (`components/charts/DspStreamChart.tsx:8`).
 *
 * Это первые ДЕСЯТЬ цветов `CHART_SERIES_COLORS`, но длина списка — часть
 * поведения: цвет выбирается как `colors[i % colors.length]`, поэтому
 * одиннадцатая площадка здесь получает зелёный, а не teal. Отдельная
 * константа сохраняет это как есть; сводить длины — осознанным шагом.
 */
export const DSP_SERIES_COLORS = CHART_SERIES_COLORS.slice(0, 10)

/**
 * Платные и бесплатные прослушивания (`BAR_COLORS` в аналитике админа,
 * те же значения — в полосах `components/analytics/Track*Bar.tsx`).
 */
export const CHART_PAID_FREE_COLORS = {
  paid: "#10b981", // emerald-500, он же токен --brand
  free: "#6b7280", // gray-500
} as const

/**
 * Самописный тултип `DspStreamChart` (там же, строки 23 и 56).
 * У `streaming-chart.tsx` тултип СВОЙ и другой — см. ниже; сведение обоих
 * в компонент ChartTooltip — этап 2.2, причина C-09.
 */
export const CHART_TOOLTIP_COLORS = {
  background: "#1f2937", // gray-800
  border: "#374151", // gray-700
  label: "#d1d5db", // gray-300
} as const

/** Тултип и оси `components/streaming-chart.tsx` (строки 48–56, 198, 212). */
export const STREAM_CHART_COLORS = {
  tooltipBackground: "rgba(15,15,15,0.95)", // тот же #0f0f0f, что --surface-dialog
  tooltipBorder: "rgba(16,185,129,0.3)", // --brand / 0.3
  tooltipLabel: "#9ca3af", // gray-400, он же --status-neutral
  tooltipValue: "#10b981", // --brand
  axisTick: "#6b7280", // gray-500
  line: "#10b981", // --brand
  activeDotStroke: "#064e3b", // emerald-900
} as const
