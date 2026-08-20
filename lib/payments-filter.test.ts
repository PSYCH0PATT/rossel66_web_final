import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isUnpaidPayment, unpaidReportWhere } from "./payments-filter"

/**
 * F-69 — строки с суммой «0 ₽» (NENEVESTA, BORDUN) числились невыплаченными и
 * входили в жёлтый счётчик «Невыплаченных 53» (docs/ui-visual-findings.md:156).
 * Платить по нулевому отчёту нечего: такая строка не долг, а шум в ключевой
 * метрике экрана /payments.
 */
describe("isUnpaidPayment", () => {
  it("нулевая сумма не считается невыплаченной", () => {
    assert.equal(isUnpaidPayment({ totalAmount: 0, isPaid: false }), false)
    assert.equal(isUnpaidPayment({ totalAmount: 0, isPaid: null }), false)
  })

  it("отсутствующая сумма не считается невыплаченной", () => {
    assert.equal(isUnpaidPayment({ totalAmount: null, isPaid: false }), false)
    assert.equal(isUnpaidPayment({ totalAmount: undefined, isPaid: null }), false)
  })

  it("реальный долг остаётся невыплаченным", () => {
    assert.equal(isUnpaidPayment({ totalAmount: 13.75, isPaid: false }), true)
    assert.equal(isUnpaidPayment({ totalAmount: 5000, isPaid: null }), true)
  })

  it("выплаченное не попадает в счётчик ни при какой сумме", () => {
    assert.equal(isUnpaidPayment({ totalAmount: 5000, isPaid: true }), false)
    assert.equal(isUnpaidPayment({ totalAmount: 0, isPaid: true }), false)
  })
})

describe("unpaidReportWhere", () => {
  it("отсекает нулевые и пустые суммы в самом запросе", () => {
    // Счётчик и фильтр «Невыплаченные» считаются в базе — предикат в памяти
    // не спасёт, если условие SQL пускает нули.
    const where = unpaidReportWhere() as { totalAmount?: unknown }
    assert.deepEqual(where.totalAmount, { gt: 0 })
  })
})
