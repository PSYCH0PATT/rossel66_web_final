import { test } from "node:test"
import assert from "node:assert/strict"

import { formatMoney, formatMoneyShort, MONEY_SYMBOL } from "./format-money"

const NBSP = " "

test("formatMoney: сумма всегда со знаком валюты", () => {
  assert.equal(formatMoney(0), `0${NBSP}₽`)
  assert.equal(formatMoney(23), `23${NBSP}₽`)
  assert.equal(MONEY_SYMBOL, "₽")
})

test("formatMoney: копейки не теряются и не додумываются", () => {
  // F-16: на /reports было «14 ₽» там же, где на /payments «13,75 ₽».
  assert.equal(formatMoney(13.75), `13,75${NBSP}₽`)
  assert.equal(formatMoney(22.54), `22,54${NBSP}₽`)
  assert.equal(formatMoney(100), `100${NBSP}₽`)
})

test("formatMoney: разряды по ru-RU", () => {
  assert.equal(formatMoney(3000), `3${NBSP}000${NBSP}₽`)
  assert.equal(formatMoney(1234567.89), `1${NBSP}234${NBSP}567,89${NBSP}₽`)
})

test("formatMoney: отрицательная сумма остаётся отрицательной", () => {
  assert.equal(formatMoney(-500), `-500${NBSP}₽`)
})

test("formatMoney: пустое и нечисловое значение дают прочерк, а не «0 ₽»", () => {
  assert.equal(formatMoney(null), "—")
  assert.equal(formatMoney(undefined), "—")
  assert.equal(formatMoney(Number.NaN), "—")
  assert.equal(formatMoney(null, { fallback: "нет данных" }), "нет данных")
})

test("formatMoney: валюту можно отключить там, где символ уже в подписи", () => {
  assert.equal(formatMoney(13.75, { currency: false }), "13,75")
})

test("formatMoneyShort: компактная сумма для KPI, со знаком валюты", () => {
  assert.equal(formatMoneyShort(999), `999${NBSP}₽`)
  assert.equal(formatMoneyShort(1500), `1,5K${NBSP}₽`)
  assert.equal(formatMoneyShort(2_000_000), `2M${NBSP}₽`)
  assert.equal(formatMoneyShort(null), "—")
})
