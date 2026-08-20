/**
 * Правила осей графиков — C-09 (docs/ui-audit.md).
 *
 * Каждый график до сих пор настраивал оси сам: последний тик обрезался у
 * правого края (F-62 — «13.08»), подписи X слипались на 390, форматтер K/M
 * в одном месте ломался на миллионах (F-05 — «0K»). Здесь общие пропсы для
 * recharts XAxis/YAxis и безопасный форматтер чисел шкалы.
 *
 * Использование (волны этапа 4):
 *   <XAxis dataKey="date" tickFormatter={formatDayMonthUtc} {...chartXAxisProps({ mobile })} />
 *   <YAxis {...chartYAxisProps()} />
 * где mobile — из useMobileDetector().
 */

import { formatAxisNumber } from "@/lib/format-compact-number"

/** Стиль подписи тика: gray-500 моно 10px — STREAM_CHART_COLORS.axisTick. */
export const CHART_AXIS_TICK = {
  fill: "#6b7280",
  fontSize: 10,
  fontFamily: "monospace",
} as const

/**
 * Короткая запись числа шкалы: 950 → «950», 2 800 → «2.8K», 125 000 → «125K»,
 * 2 800 000 → «2.8M».
 *
 * F-05: своя копия формулы жила здесь и в streaming-chart, обе округляли до
 * целых единиц масштаба («0K» на шкале, «1000K» на границе) и обе были вне
 * `pnpm test`. Единственная реализация теперь в `lib/format-compact-number.ts`.
 */
export { formatAxisNumber }

export interface ChartAxisOptions {
  /** useMobileDetector(): на телефоне тики прореживаются сильнее. */
  mobile?: boolean
}

/**
 * Пропсы XAxis: прозрачная ось, тики без линий, паддинг справа — последняя
 * подпись не срезается краем плота, minTickGap прореживает подписи на мобиле
 * вместо слипания. dataKey и tickFormatter задаёт график.
 */
export function chartXAxisProps(options: ChartAxisOptions = {}) {
  return {
    stroke: "transparent",
    tick: CHART_AXIS_TICK,
    tickLine: false,
    axisLine: false,
    padding: { right: 12 },
    interval: "preserveStartEnd",
    minTickGap: options.mobile ? 28 : 12,
  } as const
}

export interface ChartYAxisOptions {
  /** Ширина колонки подписей; 40 хватает на «2.8M». */
  width?: number
}

/** Пропсы YAxis: прозрачная ось, короткие числа через formatAxisNumber. */
export function chartYAxisProps(options: ChartYAxisOptions = {}) {
  return {
    stroke: "transparent",
    tick: CHART_AXIS_TICK,
    tickLine: false,
    axisLine: false,
    width: options.width ?? 40,
    tickFormatter: formatAxisNumber,
  } as const
}
