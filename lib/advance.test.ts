import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applyAdvanceToPayout, computeAdvanceSummary } from "./advance"

const d = (iso: string) => new Date(iso)

describe("computeAdvanceSummary", () => {
  it("returns zeroes when there are no advances", () => {
    const summary = computeAdvanceSummary([], [{ amount: 5000, uploadedAt: d("2026-01-01") }])
    assert.deepEqual(summary, { advanceTotal: 0, advanceRecouped: 0, advanceRemaining: 0 })
  })

  it("ignores royalties earned before the advance was issued", () => {
    const summary = computeAdvanceSummary(
      [{ amount: 10000, issuedAt: d("2026-03-01") }],
      [
        { amount: 4000, uploadedAt: d("2026-01-15") }, // до аванса — не в счёт
        { amount: 3000, uploadedAt: d("2026-04-15") },
      ]
    )
    assert.equal(summary.advanceTotal, 10000)
    assert.equal(summary.advanceRecouped, 3000)
    assert.equal(summary.advanceRemaining, 7000)
  })

  it("never recoups more than was issued", () => {
    const summary = computeAdvanceSummary(
      [{ amount: 5000, issuedAt: d("2026-01-01") }],
      [
        { amount: 4000, uploadedAt: d("2026-04-01") },
        { amount: 4000, uploadedAt: d("2026-07-01") },
      ]
    )
    assert.equal(summary.advanceRecouped, 5000)
    assert.equal(summary.advanceRemaining, 0)
  })

  it("lands exactly on zero when royalties match the advance", () => {
    const summary = computeAdvanceSummary(
      [{ amount: 7000, issuedAt: d("2026-01-01") }],
      [{ amount: 7000, uploadedAt: d("2026-04-01") }]
    )
    assert.equal(summary.advanceRecouped, 7000)
    assert.equal(summary.advanceRemaining, 0)
  })

  it("pays down several advances oldest first", () => {
    const summary = computeAdvanceSummary(
      [
        { amount: 5000, issuedAt: d("2026-01-01") },
        { amount: 5000, issuedAt: d("2026-06-01") },
      ],
      [{ amount: 6000, uploadedAt: d("2026-07-01") }]
    )
    assert.equal(summary.advanceTotal, 10000)
    assert.equal(summary.advanceRecouped, 6000)
    assert.equal(summary.advanceRemaining, 4000)
  })

  it("does not let a report pay down an advance issued after it", () => {
    // Отчёт пришёл в апреле, второй аванс выдан в июне — гасится только первый.
    const summary = computeAdvanceSummary(
      [
        { amount: 1000, issuedAt: d("2026-01-01") },
        { amount: 9000, issuedAt: d("2026-06-01") },
      ],
      [{ amount: 8000, uploadedAt: d("2026-04-01") }]
    )
    assert.equal(summary.advanceRecouped, 1000)
    assert.equal(summary.advanceRemaining, 9000)
  })

  it("is unaffected by the order the rows arrive in", () => {
    const advances = [
      { amount: 5000, issuedAt: d("2026-06-01") },
      { amount: 5000, issuedAt: d("2026-01-01") },
    ]
    const reports = [
      { amount: 3000, uploadedAt: d("2026-07-01") },
      { amount: 2000, uploadedAt: d("2026-03-01") },
    ]
    const summary = computeAdvanceSummary(advances, reports)
    assert.equal(summary.advanceRecouped, 5000)
    assert.equal(summary.advanceRemaining, 5000)
  })

  it("skips non-positive and broken amounts", () => {
    const summary = computeAdvanceSummary(
      [
        { amount: 0, issuedAt: d("2026-01-01") },
        { amount: Number.NaN, issuedAt: d("2026-01-01") },
        { amount: 1000, issuedAt: d("2026-01-01") },
      ],
      [
        { amount: Number.NaN, uploadedAt: d("2026-04-01") },
        { amount: -500, uploadedAt: d("2026-04-01") },
        { amount: 400, uploadedAt: d("2026-04-01") },
      ]
    )
    assert.equal(summary.advanceTotal, 1000)
    assert.equal(summary.advanceRecouped, 400)
  })

  it("keeps float noise out of the result", () => {
    const summary = computeAdvanceSummary(
      [{ amount: 100.1, issuedAt: d("2026-01-01") }],
      [
        { amount: 0.1, uploadedAt: d("2026-04-01") },
        { amount: 0.2, uploadedAt: d("2026-05-01") },
      ]
    )
    assert.equal(summary.advanceRecouped, 0.3)
    assert.equal(summary.advanceRemaining, 99.8)
  })
})

describe("applyAdvanceToPayout", () => {
  it("zeroes the payout while the advance is being recouped", () => {
    assert.equal(applyAdvanceToPayout(5000, 5000, 3000), 0)
  })

  it("keeps money earned before the advance payable", () => {
    // 9000 начислено, 4000 ушло в погашение, порог 3000 — к выплате 5000.
    assert.equal(applyAdvanceToPayout(9000, 4000, 3000), 5000)
  })

  it("still applies the minimum payout threshold", () => {
    assert.equal(applyAdvanceToPayout(4000, 2000, 3000), 0)
  })

  it("never goes negative", () => {
    assert.equal(applyAdvanceToPayout(1000, 5000, 3000), 0)
  })

  it("behaves exactly as before when there is no advance", () => {
    assert.equal(applyAdvanceToPayout(5000, 0, 3000), 5000)
    assert.equal(applyAdvanceToPayout(2999, 0, 3000), 0)
  })
})
