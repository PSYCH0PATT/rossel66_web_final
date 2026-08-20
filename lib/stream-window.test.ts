import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { analyticsStreamWindow, dashboardStreamWindow, STREAM_WINDOW_DAYS } from "./stream-window"

/**
 * F-18 — «ВСЕГО ПРОСЛУШИВАНИЙ 60» на дашборде против «ОБЩЕЕ ЧИСЛО СТРИМОВ 107»
 * в аналитике при почти одинаковых окнах графиков, и «335K» против «364 590»
 * у rompy (docs/ui-visual-findings.md:84). Два экрана считают одну метрику по
 * разным окнам: дашборд брал границы в UTC, аналитика — в МСК
 * (см. lib/msk-date.ts), поэтому окна расходились на сутки.
 */
describe("окно графика стримов", () => {
  it("дашборд и аналитика за «30 дней» просят у API один и тот же период", () => {
    const now = new Date("2026-08-13T21:30:00Z")
    assert.deepEqual(dashboardStreamWindow(30, now), analyticsStreamWindow("30d", now))
  })

  it("границы окна московские, а не UTC", () => {
    // 00:30 МСК 14 августа — это ещё 13-е по UTC. Дашборд обрывал окно вчера.
    const now = new Date("2026-08-13T21:30:00Z")
    assert.equal(dashboardStreamWindow(30, now).endDate, "2026-08-14")
    assert.equal(dashboardStreamWindow(30, now).startDate, "2026-07-15")
  })

  it("дашборд показывает окно, которое умеет показать и аналитика", () => {
    // Подпись периода на дашборде («за 30 дней») обязана совпадать с пресетом
    // селекта в аналитике — иначе числа снова разойдутся законно.
    const now = new Date("2026-08-13T10:00:00Z")
    assert.deepEqual(
      dashboardStreamWindow(STREAM_WINDOW_DAYS, now),
      analyticsStreamWindow(`${STREAM_WINDOW_DAYS}d`, now)
    )
  })

  it("месяц отсчитывается ровно на 30 дней назад через границу месяца", () => {
    const now = new Date("2026-03-05T12:00:00Z")
    assert.deepEqual(dashboardStreamWindow(30, now), {
      startDate: "2026-02-03",
      endDate: "2026-03-05",
    })
  })

  it("неизвестный пресет аналитики падает в те же 30 дней", () => {
    const now = new Date("2026-08-13T10:00:00Z")
    assert.deepEqual(analyticsStreamWindow("custom", now), dashboardStreamWindow(30, now))
  })
})
