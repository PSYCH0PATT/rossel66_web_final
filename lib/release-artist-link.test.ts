import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildReleaseArtistSelect, stripUnchangedArtistId } from "./release-artist-link"

describe("buildReleaseArtistSelect (F-02, инициализация селекта)", () => {
  it("подставляет текущую связь, когда артист есть в списке", () => {
    const select = buildReleaseArtistSelect({
      artistId: "a2",
      artistName: "Takeda",
      artists: [
        { id: "a1", name: "Jelato" },
        { id: "a2", name: "Takeda" },
      ],
    })
    assert.equal(select.value, "a2")
    assert.deepEqual(select.options, [
      { id: "a1", name: "Jelato" },
      { id: "a2", name: "Takeda" },
    ])
  })

  it("держит связь, когда артист не попал в список (страница/AKA) — селект не пустеет", () => {
    const select = buildReleaseArtistSelect({
      artistId: "a99",
      artistName: "E2E Linked",
      artists: [{ id: "a1", name: "Jelato" }],
    })
    assert.equal(select.value, "a99")
    assert.ok(
      select.options.some((option) => option.id === "a99" && option.name === "E2E Linked"),
      "текущий артист обязан быть среди опций, иначе селект показывает пустоту"
    )
  })

  it("без имени артиста подставляет сам id, лишь бы связь была видна", () => {
    const select = buildReleaseArtistSelect({ artistId: "a99", artistName: "", artists: [] })
    assert.equal(select.value, "a99")
    assert.deepEqual(select.options, [{ id: "a99", name: "a99" }])
  })

  it("релиз без артиста оставляет селект пустым и список нетронутым", () => {
    const select = buildReleaseArtistSelect({
      artistId: "",
      artistName: "",
      artists: [{ id: "a1", name: "Jelato" }],
    })
    assert.equal(select.value, "")
    assert.deepEqual(select.options, [{ id: "a1", name: "Jelato" }])
  })

  it("не задваивает артиста, если он уже в списке", () => {
    const select = buildReleaseArtistSelect({
      artistId: "a1",
      artistName: "Jelato",
      artists: [{ id: "a1", name: "Jelato" }],
    })
    assert.equal(select.options.length, 1)
  })
})

describe("stripUnchangedArtistId (F-02, защита на API)", () => {
  it("убирает пустой artistId: связь не менялась — затирать нечего", () => {
    const body = stripUnchangedArtistId({ title: "Трек", artistId: "" })
    assert.deepEqual(body, { title: "Трек" })
    assert.ok(!("artistId" in body))
  })

  it("убирает artistId из пробелов", () => {
    assert.ok(!("artistId" in stripUnchangedArtistId({ artistId: "   " })))
  })

  it("убирает artistId: null", () => {
    assert.ok(!("artistId" in stripUnchangedArtistId({ artistId: null })))
  })

  it("пропускает настоящий id — смену артиста сохранять надо", () => {
    assert.deepEqual(stripUnchangedArtistId({ title: "Трек", artistId: "a2" }), {
      title: "Трек",
      artistId: "a2",
    })
  })

  it("не трогает тело, где поля артиста вовсе нет", () => {
    assert.deepEqual(stripUnchangedArtistId({ title: "Трек" }), { title: "Трек" })
  })

  it("не мутирует исходный объект", () => {
    const original: Record<string, unknown> = { artistId: "" }
    stripUnchangedArtistId(original)
    assert.ok("artistId" in original)
  })

  it("переживает не-объект в теле запроса", () => {
    assert.deepEqual(stripUnchangedArtistId(null), null)
  })
})
