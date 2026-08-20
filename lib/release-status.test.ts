import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  releaseStatusLabel,
  releaseStatusVariant,
  releaseTrackCount,
  trackDurationText,
} from "./release-status"

/**
 * F-14 — «Я всё ещё одна» и «QUICA FUNK» показаны со статусом «ДОСТАВЛЕН»
 * при нуле треков, пустом ISRC и длительности «0:00»
 * (docs/ui-visual-findings.md:80). Доставленным считается релиз, которого в
 * данных нет: экран уверенно утверждает то, что подтвердить нечем.
 */
describe("releaseStatusVariant при пустом треклисте", () => {
  it("«Доставлен» без единого трека не выдаётся за доставленный", () => {
    assert.equal(releaseStatusVariant("Доставлен", { trackCount: 0 }), "warning")
    assert.equal(releaseStatusVariant("released", { trackCount: 0 }), "warning")
  })

  it("подпись честно говорит, что данных нет", () => {
    assert.equal(releaseStatusLabel("Доставлен", { trackCount: 0 }), "Нет данных")
  })

  it("релиз с треками остаётся доставленным", () => {
    assert.equal(releaseStatusVariant("Доставлен", { trackCount: 1 }), "live")
    assert.equal(releaseStatusLabel("Доставлен", { trackCount: 3 }), "Доставлен")
  })

  it("незавершённые статусы пустой треклист не меняет — там нулей и ждут", () => {
    assert.equal(releaseStatusVariant("На модерации", { trackCount: 0 }), "moderation")
    assert.equal(releaseStatusVariant("Отклонён", { trackCount: 0 }), "rejected")
    assert.equal(releaseStatusVariant("В доставке", { trackCount: 0 }), "delivered")
  })

  it("без контекста треклиста поведение прежнее", () => {
    assert.equal(releaseStatusVariant("Доставлен"), "live")
    assert.equal(releaseStatusLabel("Доставлен"), "Доставлен")
  })
})

describe("releaseTrackCount", () => {
  it("считает только треки с хоть какими-то данными", () => {
    assert.equal(releaseTrackCount(undefined), 0)
    assert.equal(releaseTrackCount([]), 0)
    assert.equal(releaseTrackCount([{ title: "" }, { title: "   " }]), 0)
    assert.equal(releaseTrackCount([{ title: "Трек" }]), 1)
    assert.equal(releaseTrackCount([{ title: "Трек" }, { isrc: "RU1234567890" }]), 2)
  })
})

describe("trackDurationText", () => {
  it("неизвестная длительность — «—», а не фиктивное «0:00»", () => {
    assert.equal(trackDurationText(undefined), "—")
    assert.equal(trackDurationText(""), "—")
    assert.equal(trackDurationText("0:00"), "—")
    assert.equal(trackDurationText("00:00"), "—")
    assert.equal(trackDurationText("00:00:00"), "—")
  })

  it("реальная длительность остаётся как есть", () => {
    assert.equal(trackDurationText("3:41"), "3:41")
    assert.equal(trackDurationText("00:03:41"), "00:03:41")
  })
})
