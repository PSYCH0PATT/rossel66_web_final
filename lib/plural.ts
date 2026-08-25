/**
 * Русские склонения числительных — этап 2.1 UI-overhaul (причина C-16, F-61).
 *
 * В интерфейсе живут «1 отчётов ознакомлены», «ВСЕГО: 2 ТРЕКОВ» — подпись
 * собирается конкатенацией числа и слова в одной форме. Здесь одна функция
 * на весь кабинет, чтобы такие строки перестали писать руками.
 *
 * Модуль создан на этапе 2.1 и по страницам ПОКА не применяется: подстановка
 * идёт волнами этапа 4 вместе с копирайт-проходом (docs/ui-audit.md).
 */

/** Формы слова: [1 отчёт, 2 отчёта, 5 отчётов]. */
export type PluralForms = readonly [one: string, few: string, many: string]

/**
 * Выбирает форму слова по числу.
 *
 * Правило русского языка: 1, 21, 31 — первая форма; 2–4, 22–24 — вторая;
 * 0, 5–20 и всё остальное — третья. Знак и дробная часть на выбор не влияют
 * (у «−5 дней» и «5 дней» форма одна), нечисловой ввод даёт третью форму —
 * это безопасный вариант для строки вида «нет данных».
 */
export function plural(count: number, forms: PluralForms): string {
  if (!Number.isFinite(count)) return forms[2]

  const n = Math.trunc(Math.abs(count))
  const mod10 = n % 10
  const mod100 = n % 100

  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

/**
 * Число и слово в правильной форме: `pluralize(2, [...])` → «2 трека».
 * Число форматируется по ru-RU — с неразрывным пробелом в разрядах, как
 * везде в кабинете.
 */
export function pluralize(count: number, forms: PluralForms): string {
  const value = Number.isFinite(count) ? count.toLocaleString("ru-RU") : "—"
  return `${value} ${plural(count, forms)}`
}
