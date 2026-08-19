import { test } from "node:test"
import assert from "node:assert/strict"

import { plural, pluralize } from "./plural"

test("plural: единственное число для 1, 21, 101", () => {
  assert.equal(plural(1, ["отчёт", "отчёта", "отчётов"]), "отчёт")
  assert.equal(plural(21, ["отчёт", "отчёта", "отчётов"]), "отчёт")
  assert.equal(plural(101, ["отчёт", "отчёта", "отчётов"]), "отчёт")
})

test("plural: форма 2–4 для 2, 3, 4, 22", () => {
  assert.equal(plural(2, ["трек", "трека", "треков"]), "трека")
  assert.equal(plural(3, ["трек", "трека", "треков"]), "трека")
  assert.equal(plural(4, ["трек", "трека", "треков"]), "трека")
  assert.equal(plural(22, ["трек", "трека", "треков"]), "трека")
})

test("plural: форма многих для 0, 5–20, 25, 111", () => {
  const forms: [string, string, string] = ["релиз", "релиза", "релизов"]
  assert.equal(plural(0, forms), "релизов")
  assert.equal(plural(5, forms), "релизов")
  assert.equal(plural(11, forms), "релизов")
  assert.equal(plural(12, forms), "релизов")
  assert.equal(plural(14, forms), "релизов")
  assert.equal(plural(25, forms), "релизов")
  assert.equal(plural(111, forms), "релизов")
})

test("plural: знак и дробная часть не влияют на выбор формы", () => {
  const forms: [string, string, string] = ["день", "дня", "дней"]
  assert.equal(plural(-1, forms), "день")
  assert.equal(plural(-5, forms), "дней")
  assert.equal(plural(1.4, forms), "день")
})

test("plural: нечисловой ввод даёт форму многих, а не «undefined»", () => {
  const forms: [string, string, string] = ["день", "дня", "дней"]
  assert.equal(plural(Number.NaN, forms), "дней")
  assert.equal(plural(Number.POSITIVE_INFINITY, forms), "дней")
})

test("pluralize: число и слово вместе, число по ru-RU", () => {
  assert.equal(pluralize(1, ["отчёт", "отчёта", "отчётов"]), "1 отчёт")
  assert.equal(pluralize(2, ["трек", "трека", "треков"]), "2 трека")
  // Разряды ru-RU разделяются неразрывным пробелом (U+00A0), а не обычным.
  assert.equal(pluralize(1000, ["трек", "трека", "треков"]), "1\u00A0000 треков")
})
