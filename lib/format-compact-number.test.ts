import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatAxisNumber, formatCompactNumber } from "./format-compact-number"

/**
 * F-05 — ось Y графика стримов «0K, 0K, 0K, 0» при 2.8M прослушиваний
 * (docs/ui-visual-findings.md:60). Причина одна на все подписи: округление до
 * K/M выполнялось до целых, поэтому всё, что меньше единицы масштаба,
 * схлопывалось в ноль, а всё, что подошло к следующему масштабу, оставалось в
 * предыдущем («1000K» вместо «1M»).
 */
describe("formatAxisNumber (ось Y)", () => {
  it("не превращает подписи шкалы в «0K»", () => {
    // Суточные значения при 2.8M за месяц дают тики в сотнях и тысячах.
    assert.equal(formatAxisNumber(0), "0")
    assert.equal(formatAxisNumber(240), "240")
    assert.equal(formatAxisNumber(700), "700")
    assert.equal(formatAxisNumber(950), "950")
  })

  it("не выдаёт «1000K» на границе масштаба", () => {
    assert.equal(formatAxisNumber(999_500), "1M")
    assert.equal(formatAxisNumber(1_000_000), "1M")
    assert.equal(formatAxisNumber(999_949_000), "1000M")
  })

  it("держит K и M в читаемом виде", () => {
    assert.equal(formatAxisNumber(2_800), "2.8K")
    assert.equal(formatAxisNumber(125_000), "125K")
    assert.equal(formatAxisNumber(2_800_000), "2.8M")
    assert.equal(formatAxisNumber(-2_800), "-2.8K")
  })

  it("подписи монотонной шкалы не повторяются и не идут вразнобой", () => {
    // Ровно то, что видно на скриншоте артиста: «8K, 4K, 9K, 5K, 0» — подписи,
    // по которым нельзя прочитать значение. Тики recharts всегда возрастают,
    // значит и подписи обязаны возрастать и различаться.
    const ticks = [0, 15_121, 30_242, 45_363, 60_484]
    const labels = ticks.map(formatAxisNumber)
    assert.equal(new Set(labels).size, labels.length, `дубли в подписях: ${labels.join(", ")}`)
  })
})

describe("formatCompactNumber (метрика над графиком)", () => {
  it("не теряет порядок величины на границе K→M", () => {
    assert.equal(formatCompactNumber(999_500), "1M")
    assert.equal(formatCompactNumber(1_000_000), "1M")
  })

  it("не округляет тысячи до неразличимых значений", () => {
    // 2 800 и 3 400 показывались одинаково — «3K».
    assert.notEqual(formatCompactNumber(2_800), formatCompactNumber(3_400))
    assert.equal(formatCompactNumber(2_800), "2.8K")
  })

  it("мелкие числа остаются как есть", () => {
    assert.equal(formatCompactNumber(0), "0")
    assert.equal(formatCompactNumber(60), "60")
    assert.equal(formatCompactNumber(107), "107")
  })
})
