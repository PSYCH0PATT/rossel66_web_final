import { test } from "node:test"
import assert from "node:assert/strict"

import { releaseArtistsLine } from "./release-artists"

test("один артист — одно имя", () => {
  assert.equal(releaseArtistsLine({ artistName: "rompy" }, "кабинет"), "rompy")
})

test("фиты релиза и треков собираются в одну строку без дублей", () => {
  const release = {
    artistName: "rompy",
    featuredArtistNames: ["Лоло"],
    tracks: [{ featuredArtistNames: ["Лоло", "Скайя"] }],
  }
  assert.equal(releaseArtistsLine(release, "кабинет"), "rompy, Лоло, Скайя")
})

test("основной артист не повторяется в списке приглашённых", () => {
  const release = { artistName: "rompy", featuredArtistNames: ["rompy", "Лоло"] }
  assert.equal(releaseArtistsLine(release, "кабинет"), "rompy, Лоло")
})

test("без artistName берётся имя кабинета, а не пустая строка", () => {
  assert.equal(releaseArtistsLine({ artistName: "  " }, "rompy"), "rompy")
  assert.equal(releaseArtistsLine(null, "rompy"), "rompy")
})
