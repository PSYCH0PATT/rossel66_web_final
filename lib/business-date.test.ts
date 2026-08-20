import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { todayIso } from "./business-date"

/**
 * F-67 — поле «Дата выдачи» аванса открывалось с завтрашним числом
 * (docs/ui-visual-findings.md:154). Дефолт считался в часовом поясе браузера,
 * а рабочий день компании и весь пайплайн отчётов живут по Москве
 * (см. lib/msk-date.ts). У зрителя восточнее МСК «сегодня» наступает раньше —
 * и в POST /api/advances уезжала дата, которой ещё не было: от неё
 * lib/advance.ts считает, какие отчёты гасят аванс.
 */
describe("todayIso", () => {
  const originalTz = process.env.TZ

  function withTimezone<T>(tz: string, fn: () => T): T {
    process.env.TZ = tz
    try {
      return fn()
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  }

  it("возвращает московскую дату, а не дату часового пояса зрителя", () => {
    // 18 августа, 16:00 МСК. В Окленде (UTC+12) это уже 19-е.
    const at = new Date("2026-08-18T13:00:00Z")
    assert.equal(withTimezone("Pacific/Auckland", () => todayIso(at)), "2026-08-18")
    assert.equal(withTimezone("America/Los_Angeles", () => todayIso(at)), "2026-08-18")
    assert.equal(withTimezone("Europe/Moscow", () => todayIso(at)), "2026-08-18")
  })

  it("держит границу московских суток", () => {
    // 23:30 МСК 18-го — ещё 18-е; 00:30 МСК 19-го — уже 19-е.
    assert.equal(todayIso(new Date("2026-08-18T20:30:00Z")), "2026-08-18")
    assert.equal(todayIso(new Date("2026-08-18T21:30:00Z")), "2026-08-19")
  })
})
