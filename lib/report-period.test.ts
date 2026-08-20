import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { quarterPeriodRange, reportPeriodLabel, reportUploadedLabel } from "./report-period"

/**
 * F-15 — «Q4 2025» с датой 17.08.2026, «Q1 2026» с датой 31.05.2026
 * (docs/ui-visual-findings.md:81). Дата загрузки файла стоит рядом с
 * названием квартала без подписи и с иконкой календаря — читается как дата
 * периода или подписания. Противоречия в данных нет: это две разные даты,
 * и на экране они обязаны называться по-разному.
 */
describe("reportUploadedLabel", () => {
  it("дата загрузки подписана и не выдаёт себя за период", () => {
    assert.equal(reportUploadedLabel("2026-08-17"), "Загружен: 17.08.2026")
    assert.equal(reportUploadedLabel(new Date("2026-05-31T00:00:00Z")), "Загружен: 31.05.2026")
  })

  it("пустая дата не превращается в 01.01.1970", () => {
    assert.equal(reportUploadedLabel(null), "Загружен: —")
    assert.equal(reportUploadedLabel(undefined), "Загружен: —")
    assert.equal(reportUploadedLabel(""), "Загружен: —")
  })

  it("не сдвигает дату на день у зрителя западнее UTC", () => {
    // Прежний new Date(...).toLocaleDateString() читал локальную дату.
    assert.equal(reportUploadedLabel("2026-08-17T00:00:00.000Z"), "Загружен: 17.08.2026")
  })
})

describe("reportPeriodLabel и quarterPeriodRange", () => {
  it("период отчёта считается из квартала, а не из даты файла", () => {
    assert.equal(reportPeriodLabel("Q4", 2025), "01.10.2025 — 31.12.2025")
    assert.equal(reportPeriodLabel("Q1", 2026), "01.01.2026 — 31.03.2026")
  })

  it("границы кварталов календарные", () => {
    assert.deepEqual(quarterPeriodRange("Q1", 2026), { start: "2026-01-01", end: "2026-03-31" })
    assert.deepEqual(quarterPeriodRange("Q2", 2026), { start: "2026-04-01", end: "2026-06-30" })
    assert.deepEqual(quarterPeriodRange("Q3", 2026), { start: "2026-07-01", end: "2026-09-30" })
    assert.deepEqual(quarterPeriodRange("Q4", 2025), { start: "2025-10-01", end: "2025-12-31" })
  })

  it("неизвестный квартал не выдумывает период", () => {
    assert.equal(quarterPeriodRange("Q9", 2026), null)
    assert.equal(quarterPeriodRange("Q1", null), null)
    assert.equal(reportPeriodLabel("Q9", 2026), "—")
  })
})
