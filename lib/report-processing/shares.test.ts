import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  calculateArtistShare,
  loadRoyaltySharesFromTracks,
  normalizeShareKeys,
  parsePercentage,
} from "./shares"
import type { ArtistReportData } from "./artists"

const data = (id: string): ArtistReportData => ({
  fio: "Ф", fioShort: "Ф.", contract: "Д", percentage: "100", id,
})
const roster = new Map([["A", data("1")], ["B", data("2")]])
const empty = new Map()

describe("нормализация ключей долей", () => {
  const alias = new Map([["Второе Имя", "Главный"], ["aka2", "Главный"]])

  it("доля под именем привязанного находится по главному", () => {
    const shares = new Map([["ISRC1", new Map([["Второе Имя", 0.4], ["Соло", 0.6]])]])
    const result = normalizeShareKeys(shares, alias)
    assert.equal(result.get("ISRC1")!.get("Главный"), 0.4)
    assert.equal(result.get("ISRC1")!.get("Соло"), 0.6)
  })

  it("доли одной группы складываются", () => {
    const shares = new Map([["ISRC2", new Map([["Главный", 0.3], ["aka2", 0.2]])]])
    const result = normalizeShareKeys(shares, alias)
    assert.ok(Math.abs(result.get("ISRC2")!.get("Главный")! - 0.5) < 1e-9)
  })

  it("пустая карта псевдонимов ничего не меняет", () => {
    const shares = new Map([["ISRC3", new Map([["Соло", 1]])]])
    assert.equal(normalizeShareKeys(shares, new Map()), shares)
  })
})

describe("доли из релизов", () => {
  it("проценты переводятся в доли", () => {
    const result = loadRoyaltySharesFromTracks([
      { tracks: [{ isrc: "X", royaltyShares: { A: 60, B: 40 } }] },
    ])
    assert.equal(result.get("X")!.get("A"), 0.6)
    assert.equal(result.get("X")!.get("B"), 0.4)
  })

  it("нулевые и отрицательные доли отбрасываются", () => {
    const result = loadRoyaltySharesFromTracks([
      { tracks: [{ isrc: "X", royaltyShares: { A: 0, B: -5, C: 10 } }] },
    ])
    assert.equal(result.get("X")!.has("A"), false)
    assert.equal(result.get("X")!.has("B"), false)
    assert.equal(result.get("X")!.get("C"), 0.1)
  })
})

describe("расчёт доли артиста", () => {
  it("артист один в треке — сто процентов, даже если прописаны доли", () => {
    const withShares = new Map([["T", new Map([["A", 0.4]])]])
    assert.equal(calculateArtistShare("T", "A", ["A"], roster, empty, withShares), 1)
  })

  it("явные доли из релизов важнее равного деления", () => {
    const withShares = new Map([["T", new Map([["A", 0.7], ["B", 0.3]])]])
    assert.equal(calculateArtistShare("T", "A", ["A", "B"], roster, empty, withShares), 0.7)
  })

  it("все участники наши — делим поровну", () => {
    assert.equal(calculateArtistShare("T", "A", ["A", "B"], roster, empty, empty), 0.5)
  })

  it("посторонний участник не уменьшает долю наших", () => {
    // Доля постороннего перераспределяется между нашими — так вёл себя питон.
    assert.equal(calculateArtistShare("T", "A", ["A", "Чужой"], roster, empty, empty), 1)
  })

  it("наших в треке нет — ноль", () => {
    assert.equal(calculateArtistShare("T", "X", ["X", "Y"], roster, empty, empty), 0)
  })
})

describe("разбор процента артиста", () => {
  it("целое число", () => {
    assert.deepEqual(parsePercentage("70"), { fraction: 0.7, text: "70%" })
  })
  it("хвостовые нули убираются только при наличии точки", () => {
    assert.deepEqual(parsePercentage("60.0"), { fraction: 0.6, text: "60%" })
    assert.deepEqual(parsePercentage("50.5"), { fraction: 0.505, text: "50.5%" })
  })
  it("запятая и знак процента разбираются", () => {
    assert.deepEqual(parsePercentage("60,5"), { fraction: 0.605, text: "60.5%" })
    assert.deepEqual(parsePercentage("75%"), { fraction: 0.75, text: "75%" })
  })
  it("ноль допустим", () => {
    assert.deepEqual(parsePercentage("0"), { fraction: 0, text: "0%" })
  })
  it("мусор — сто процентов", () => {
    assert.deepEqual(parsePercentage("abc"), { fraction: 1, text: "100%" })
  })
})
