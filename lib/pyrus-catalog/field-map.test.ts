import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CATALOG_RELEASE_FIELD_IDS,
  collectDuplicateFieldIdsInSlot,
} from "./field-map"
import snapshot from "./form-2312633.snapshot.json"

describe("field-map", () => {
  it("has 5 release slots", () => {
    assert.equal(CATALOG_RELEASE_FIELD_IDS.length, 5)
  })

  it("4th single uses genre id 245 and releaseDate 175", () => {
    const fourth = CATALOG_RELEASE_FIELD_IDS[3].single
    assert.equal(fourth.releaseDate, 175)
    assert.equal(fourth.genre, 245)
    assert.notEqual(fourth.releaseDate, fourth.genre)
  })

  it("no duplicate field ids within any slot", () => {
    for (let i = 0; i < CATALOG_RELEASE_FIELD_IDS.length; i++) {
      const dupes = collectDuplicateFieldIdsInSlot(CATALOG_RELEASE_FIELD_IDS[i])
      assert.deepEqual(dupes, [], `slot ${i + 1} has duplicate ids: ${dupes.join(", ")}`)
    }
  })

  it("snapshot contains field 245 as text Жанр", () => {
    const f = snapshot.flat.find((x) => x.id === 245)
    assert.ok(f)
    assert.equal(f.type, "text")
    assert.match(f.name, /Жанр/i)
  })

  it("snapshot field 175 is date for 4th single release date", () => {
    const f = snapshot.flat.find((x) => x.id === 175)
    assert.ok(f)
    assert.equal(f.type, "date")
  })
})
