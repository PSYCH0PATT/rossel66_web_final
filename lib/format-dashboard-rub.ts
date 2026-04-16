/** Компактная сумма для KPI: одна строка, K / M (латинские K/M), без знака валюты */
export function formatRubKpiShort(n: number): string {
  const x = Math.round(Math.max(0, n))
  const kRounded = Math.round(x / 1000)
  if (x >= 1_000_000 || kRounded >= 1000) {
    const m = x / 1_000_000
    return `${m.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(m) ? 0 : 1 })}M`
  }
  if (x >= 1000) {
    return `${kRounded.toLocaleString("ru-RU")}K`
  }
  return `${x.toLocaleString("ru-RU")}`
}

/** Точная сумма: число по ru-RU, без знака валюты */
export function formatRubPlain(n: number): string {
  const x = Math.max(0, n)
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(x)
}

/** Алиас для подсказок / обратной совместимости */
export function formatRubExact(n: number): string {
  return formatRubPlain(n)
}
