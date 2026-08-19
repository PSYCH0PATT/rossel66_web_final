import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_BULK_ARTIST_NAMES,
  artistNameToUsername,
  duplicateArtistReason,
  planBulkArtistAdd,
} from "./bulk-artist-add"

describe("DEFAULT_BULK_ARTIST_NAMES (F-01)", () => {
  it("пуст: экран массового добавления открывается без предзаполненного списка", () => {
    assert.deepEqual([...DEFAULT_BULK_ARTIST_NAMES], [])
  })

  it("клик «Добавить всех» на дефолтном списке ничего не создаёт", () => {
    const existing = [{ username: "peredoz", name: "передоз" }]
    const plan = planBulkArtistAdd([...DEFAULT_BULK_ARTIST_NAMES], existing)
    assert.deepEqual(plan.toCreate, [])
    assert.equal(plan.skippedDuplicates.length, 0)
  })
})

describe("planBulkArtistAdd (F-01, дедупликация)", () => {
  it("пропускает артиста, чей логин уже занят", () => {
    const plan = planBulkArtistAdd(["Takeda"], [{ username: "takeda", name: "Takeda" }])
    assert.deepEqual(plan.toCreate, [])
    assert.deepEqual(plan.skippedDuplicates, ["Takeda"])
  })

  it("пропускает по имени, даже если логин в базе другой", () => {
    const plan = planBulkArtistAdd(
      ["Sour Diesel"],
      [{ username: "sour_diesel_2021", name: "sour diesel" }]
    )
    assert.deepEqual(plan.toCreate, [])
    assert.deepEqual(plan.skippedDuplicates, ["Sour Diesel"])
  })

  it("схлопывает повторы внутри самого списка", () => {
    const plan = planBulkArtistAdd(["Jelato", "  jelato  ", "Jelato"], [])
    assert.deepEqual(
      plan.toCreate.map((entry) => entry.name),
      ["Jelato"]
    )
    assert.equal(plan.skippedDuplicates.length, 2)
  })

  it("выбрасывает пустые строки, а не считает их артистами", () => {
    const plan = planBulkArtistAdd(["", "   ", "PLVT"], [])
    assert.deepEqual(
      plan.toCreate.map((entry) => entry.name),
      ["PLVT"]
    )
    assert.deepEqual(plan.skippedDuplicates, [])
  })

  it("кириллические имена не считает дублями друг друга из-за пустого логина", () => {
    const plan = planBulkArtistAdd(["передоз", "Нэйви"], [])
    assert.deepEqual(
      plan.toCreate.map((entry) => entry.name),
      ["передоз", "Нэйви"]
    )
  })

  it("отдаёт логин и имя для создания", () => {
    const plan = planBulkArtistAdd(["Roudie J."], [])
    assert.deepEqual(plan.toCreate, [{ name: "Roudie J.", username: "roudiej" }])
  })
})

describe("duplicateArtistReason (F-01, серверная защита)", () => {
  it("ловит совпадение логина без учёта регистра", () => {
    assert.equal(
      duplicateArtistReason({ username: "TAKEDA", name: "Кто-то" }, [
        { username: "takeda", name: "Takeda" },
      ]),
      "username"
    )
  })

  it("ловит совпадение имени, когда логин свободен", () => {
    assert.equal(
      duplicateArtistReason({ username: "takeda2", name: " takeda " }, [
        { username: "takeda", name: "Takeda" },
      ]),
      "name"
    )
  })

  it("молчит, когда артист действительно новый", () => {
    assert.equal(
      duplicateArtistReason({ username: "wvlaik", name: "wvlaik" }, [
        { username: "takeda", name: "Takeda" },
      ]),
      null
    )
  })
})

describe("artistNameToUsername", () => {
  it("оставляет латиницу и цифры в нижнем регистре", () => {
    assert.equal(artistNameToUsername("W.1ce3"), "w1ce3")
  })

  it("на нелатинском имени отдаёт пустую строку", () => {
    assert.equal(artistNameToUsername("передоз"), "")
  })
})
