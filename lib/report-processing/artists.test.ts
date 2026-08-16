import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildArtistsIndex,
  extractArtistsFromTrack,
  missingReportFields,
  type ExportedArtist,
} from "./artists"

/** Тот же набор, что был в питон-тестах: группа AKA, битая ссылка, неполный. */
const artist = (id: string, name: string, username: string, extra: Partial<ExportedArtist> = {}) => ({
  id, role: "artist", name, username,
  fio: `Фамилия ${name}`, contract: `Д-${id}`, percentage: 100,
  ...extra,
})

const GROUP_USERS: ExportedArtist[] = [
  artist("1", "Главный", "main"),
  artist("2", "Второе Имя", "aka2", { mainArtistId: "1" }),
  artist("3", "Соло", "solo"),
  artist("4", "Битая Ссылка", "broken", { mainArtistId: "999" }),
  { id: "5", role: "artist", name: "Неполный", username: "incomplete", percentage: 50 },
  artist("6", "Дитя Неполного", "child", { mainArtistId: "5" }),
]

describe("группировка связанных профилей", () => {
  const index = buildArtistsIndex(GROUP_USERS)
  const aliases = new Map(index.matchList.map((m) => [m.canonical, m.aliases]))

  it("привязанный профиль не становится отдельным артистом", () => {
    assert.equal(index.artistsData.has("Второе Имя"), false)
    assert.equal(index.artistsData.has("Главный"), true)
  })

  it("имена группы становятся псевдонимами главного", () => {
    assert.deepEqual(
      new Set(aliases.get("Главный")),
      new Set(["Главный", "main", "Второе Имя", "aka2"])
    )
  })

  it("реквизиты берутся у главного", () => {
    const data = index.artistsData.get("Главный")!
    assert.equal(data.fio, "Фамилия Главный")
    assert.equal(data.contract, "Д-1")
    assert.equal(data.percentage, "100")
    assert.equal(data.id, "1")
  })

  it("битая ссылка на удалённого главного — артист работает сам по себе", () => {
    assert.equal(index.artistsData.has("Битая Ссылка"), true)
  })

  it("неполный главный уводит группу, но псевдонимы остаются", () => {
    const skipped = index.skippedIncomplete.map((s) => s.name)
    assert.equal(skipped.filter((n) => n === "Неполный").length, 1)
    assert.equal(skipped.includes("Дитя Неполного"), false)
    // Без псевдонимов строки привязанного молча попали бы в «нераспознанные».
    assert.deepEqual(
      new Set(aliases.get("Неполный")),
      new Set(["Неполный", "incomplete", "Дитя Неполного", "child"])
    )
  })

  it("карта псевдонимов ведёт на canonical главного", () => {
    assert.equal(index.aliasToCanonical.get("Второе Имя"), "Главный")
    assert.equal(index.aliasToCanonical.get("aka2"), "Главный")
    assert.equal(index.aliasToCanonical.get("Соло"), "Соло")
  })
})

describe("сопоставление строки исполнителя", () => {
  const { matchList } = buildArtistsIndex(GROUP_USERS)
  const match = (s: string) => extractArtistsFromTrack(s, matchList)

  it("имя привязанного профиля ведёт на главного", () => {
    assert.deepEqual(match("Второе Имя"), ["Главный"])
    assert.deepEqual(match("aka2"), ["Главный"])
  })

  it("коллаборация с посторонним делится правильно", () => {
    assert.deepEqual(new Set(match("Второе Имя feat. Соло")), new Set(["Главный", "Соло"]))
  })

  it("коллаборация внутри одной группы считает человека один раз", () => {
    assert.deepEqual(match("Главный & Второе Имя"), ["Главный"])
  })

  it("незнакомое имя не матчится", () => {
    assert.deepEqual(match("Кто-то Совсем Левый"), [])
  })

  it("имя матчится только целым словом, а не подстрокой", () => {
    // Ключевая защита: иначе «Соло» поймает «Сологуб», и артист получит чужие деньги.
    const roster = buildArtistsIndex([
      artist("1", "Ян", "yan"),
      artist("2", "Rem", "rem"),
    ]).matchList
    assert.deepEqual(extractArtistsFromTrack("Боян", roster), [])
    assert.deepEqual(extractArtistsFromTrack("Rema", roster), [])
    assert.deepEqual(extractArtistsFromTrack("Ян", roster), ["Ян"])
    // Дефис словом не считается — имя по-прежнему находится.
    assert.deepEqual(extractArtistsFromTrack("MC-Ян", roster), ["Ян"])
  })

  it("регистр не важен", () => {
    assert.deepEqual(match("ГЛАВНЫЙ"), ["Главный"])
    assert.deepEqual(match("главный"), ["Главный"])
  })
})

describe("проверка реквизитов", () => {
  it("прочерк и пустая строка считаются отсутствующими", () => {
    assert.deepEqual(missingReportFields({ fio: "-", contract: "", percentage: 50 }), [
      "fio", "contract",
    ])
  })

  it("нулевой процент допустим", () => {
    // Отличие от lib/artist-report-requirements.ts: там ноль считается пропуском.
    assert.deepEqual(missingReportFields({ fio: "Ф", contract: "Д", percentage: 0 }), [])
  })

  it("отсутствующий процент — пропуск", () => {
    assert.deepEqual(missingReportFields({ fio: "Ф", contract: "Д" }), ["percentage"])
  })
})
