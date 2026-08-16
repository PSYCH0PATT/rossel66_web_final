import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pyRound } from "./rounding"

describe("pyRound — совместимость с round() из Python", () => {
  it("округляет половину к чётному, а не вверх", () => {
    // Значения, точно представимые в double: настоящие «половины».
    assert.equal(pyRound(0.125, 2), 0.12)
    assert.equal(pyRound(0.375, 2), 0.38)
    assert.equal(pyRound(2.5, 0), 2)
    assert.equal(pyRound(3.5, 0), 4)
  })

  it("смотрит на точное значение double, а не на десятичную запись", () => {
    // 2.675 в двоичном виде чуть МЕНЬШЕ записи — вниз.
    assert.equal(pyRound(2.675, 2), 2.67)
    // 2106.775 чуть БОЛЬШЕ — вверх. Это реальная сумма из эталонного отчёта:
    // ошибка здесь стоила бы копейки в каждом отчёте.
    assert.equal(pyRound(2106.775, 2), 2106.78)
    assert.equal(pyRound(166.665, 2), 166.66)
    assert.equal(pyRound(123456.785, 2), 123456.79)
  })

  it("не трогает значения, которые и так короче", () => {
    assert.equal(pyRound(1234.56, 2), 1234.56)
    assert.equal(pyRound(0, 2), 0)
    assert.equal(pyRound(99.99, 2), 99.99)
  })

  it("работает с отрицательными", () => {
    assert.equal(pyRound(-2.675, 2), -2.67)
    assert.equal(pyRound(-2.5, 0), -2)
    assert.equal(pyRound(-1234.567, 2), -1234.57)
  })

  it("переживает нечисловые значения", () => {
    assert.ok(Number.isNaN(pyRound(Number.NaN)))
    assert.equal(pyRound(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY)
  })

  it("умеет другую точность", () => {
    assert.equal(pyRound(1.23456, 3), 1.235)
    assert.equal(pyRound(1.5, 0), 2)
    assert.equal(pyRound(12345.6789, 1), 12345.7)
  })
})
