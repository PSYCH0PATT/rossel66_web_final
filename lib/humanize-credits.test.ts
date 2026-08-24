import { test } from "node:test"
import assert from "node:assert/strict"

import { humanizeCredits } from "./humanize-credits"

test("F-91: точка с запятой становится запятой с пробелом", () => {
  assert.equal(humanizeCredits("rompy;Лоло - беги"), "rompy, Лоло — беги")
})

test("регистр берётся из данных и не додумывается", () => {
  assert.equal(humanizeCredits("ROMPY;ЛОЛО"), "ROMPY, ЛОЛО")
})

test("дефис внутри слова остаётся дефисом", () => {
  assert.equal(humanizeCredits("Пост-панк - трек"), "Пост-панк — трек")
})

test("пустые части и лишние пробелы отбрасываются", () => {
  assert.equal(humanizeCredits(" a ;; b "), "a, b")
})

test("пустое значение — пустая строка, а не «undefined»", () => {
  assert.equal(humanizeCredits(null), "")
  assert.equal(humanizeCredits(undefined), "")
  assert.equal(humanizeCredits(""), "")
})
