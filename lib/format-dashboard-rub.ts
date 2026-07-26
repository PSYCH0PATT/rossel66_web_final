/**
 * Форматирование сумм для KPI дашбордов.
 *
 * C6: раньше обе функции делали `Math.max(0, n)` — отрицательная сумма
 * (переплата, корректировка) молча показывалась как «0», то есть проблему
 * с деньгами было не видно ни артисту, ни админу. Плюс `Math.round(x / 1000)`
 * округлял 1500 ₽ до «2K» — завышение на четверть. Теперь знак сохраняется,
 * а в диапазоне тысяч показывается один знак после запятой.
 */

/** Компактная сумма для KPI: одна строка, K / M (латинские K/M), без знака валюты */
export function formatRubKpiShort(n: number): string {
  if (!Number.isFinite(n)) return "0"

  const rounded = Math.round(n)
  const sign = rounded < 0 ? "−" : ""
  const abs = Math.abs(rounded)

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    return `${sign}${m.toLocaleString("ru-RU", {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(m) ? 0 : 1,
    })}M`
  }

  if (abs >= 1000) {
    const k = abs / 1000
    return `${sign}${k.toLocaleString("ru-RU", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })}K`
  }

  return `${sign}${abs.toLocaleString("ru-RU")}`
}

/** Точная сумма: число по ru-RU, без знака валюты */
export function formatRubPlain(n: number): string {
  if (!Number.isFinite(n)) return "0"
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n)
}

/** Алиас для подсказок / обратной совместимости */
export function formatRubExact(n: number): string {
  return formatRubPlain(n)
}
