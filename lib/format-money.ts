/**
 * Деньги в интерфейсе — этап 2.1 UI-overhaul (причина C-16, F-16).
 *
 * Сейчас одна и та же сумма на соседних экранах выглядит по-разному:
 * «23» без валюты в счётчиках дашборда, «14 ₽» округлённое на /reports,
 * «13,75 ₽» точное на /payments. Здесь одно правило: копейки показываем,
 * если они есть, символ валюты — всегда (кроме случая, когда он уже стоит
 * в подписи колонки), пустое значение — прочерк, а не «0 ₽».
 *
 * Числовая часть считается теми же `formatRubPlain` / `formatRubKpiShort`,
 * что и раньше: разряды, округление и знак минуса не меняются, добавляется
 * только валюта и обработка пустого значения.
 *
 * Модуль создан на этапе 2.1 и по страницам ПОКА не применяется —
 * подстановка идёт волнами этапа 4 (docs/ui-audit.md).
 */
import { formatRubKpiShort, formatRubPlain } from "@/lib/format-dashboard-rub"

/** Символ валюты кабинета. Строк «руб.», «RUB» и «р.» в интерфейсе быть не должно. */
export const MONEY_SYMBOL = "₽"

/** Неразрывный пробел: сумма не должна переноситься между числом и «₽». */
const NBSP = " "

export type FormatMoneyOptions = {
  /** Показывать «₽». Выключается только там, где валюта уже в заголовке. */
  currency?: boolean
  /** Что вернуть для пустого/нечислового значения. */
  fallback?: string
}

function withCurrency(value: string, currency: boolean): string {
  return currency ? `${value}${NBSP}${MONEY_SYMBOL}` : value
}

/**
 * Точная сумма: «13,75 ₽», «3 000 ₽», «-500 ₽».
 * До двух знаков после запятой и только если они есть.
 */
export function formatMoney(
  value: number | null | undefined,
  { currency = true, fallback = "—" }: FormatMoneyOptions = {}
): string {
  if (value == null || !Number.isFinite(value)) return fallback
  return withCurrency(formatRubPlain(value), currency)
}

/**
 * Компактная сумма для KPI-плиток: «1,5K ₽», «2M ₽».
 * Для сумм меньше тысячи совпадает с `formatMoney` без копеек.
 */
export function formatMoneyShort(
  value: number | null | undefined,
  { currency = true, fallback = "—" }: FormatMoneyOptions = {}
): string {
  if (value == null || !Number.isFinite(value)) return fallback
  return withCurrency(formatRubKpiShort(value), currency)
}
