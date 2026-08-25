/**
 * Короткая запись больших чисел — ось графиков и крупные метрики (F-05).
 *
 * Формула жила двумя копиями в компонентах (`components/charts/chart-axis.ts`
 * и `components/streaming-chart.tsx`), не была покрыта `pnpm test` и в обеих
 * копиях округляла до целых единиц масштаба. Из-за этого подписи оси
 * схлопывались в «0K», а на границе K→M появлялось «1000K» вместо «1M».
 *
 * Правила одни на ось и на метрику:
 *  - меньше 1 000 — число как есть, никаких «0K»;
 *  - до десяти единиц масштаба — один знак после точки (2.8K, 1.5M);
 *  - дальше — целые (125K, 364K);
 *  - если округление добежало до 1 000 единиц — переходим к следующему
 *    масштабу (999 500 → «1M», а не «1000K»).
 */

const UNITS: Array<{ unit: number; suffix: string }> = [
  { unit: 1_000_000, suffix: "M" },
  { unit: 1_000, suffix: "K" },
]

/** Значение в единицах масштаба: до 10 — с десятыми, дальше — целое. */
function scaled(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}

function compact(abs: number): string {
  let index = UNITS.findIndex(({ unit }) => abs >= unit)
  if (index < 0) return String(abs)

  let text = scaled(abs / UNITS[index].unit)
  // Округление добежало до следующего масштаба: 999 500 → «1M», не «1000K».
  if (Number(text) >= 1000 && index > 0) {
    index -= 1
    text = scaled(abs / UNITS[index].unit)
  }
  return `${text}${UNITS[index].suffix}`
}

/** Подпись тика оси Y: 950 → «950», 2 800 → «2.8K», 2 800 000 → «2.8M». */
export function formatAxisNumber(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const abs = Math.abs(value)
  if (abs < 1_000) return String(value)
  return `${value < 0 ? "-" : ""}${compact(abs)}`
}

/** Крупная метрика над графиком — та же шкала, что и на оси. */
export function formatCompactNumber(value: number): string {
  return formatAxisNumber(value)
}
