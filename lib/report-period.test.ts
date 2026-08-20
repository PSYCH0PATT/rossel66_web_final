import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { reportUploadedLabel } from "./report-period"

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
