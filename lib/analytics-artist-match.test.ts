import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAnalyticsArtistLookup,
  isCollabFullyResolvedInRoster,
  needsManualUnmappedMapping,
  remapToMainArtistIds,
  type AnalyticsArtistUser,
} from "./analytics-artist-match"

const rosterUsers: AnalyticsArtistUser[] = [
  { id: "id-rompy", name: "rompy", username: "rompy" },
  { id: "id-lolo", name: "Лоло", username: "lolo" },
  { id: "id-solo", name: "Solo Artist", username: "solo" },
]

function makeLookup(users: AnalyticsArtistUser[] = rosterUsers) {
  return buildAnalyticsArtistLookup(users, [])
}

describe("isCollabFullyResolvedInRoster", () => {
  it("returns true when all collab tokens match roster artists", () => {
    const lookup = makeLookup()
    assert.equal(isCollabFullyResolvedInRoster("rompy & Лоло", lookup), true)
  })

  it("returns false when one collab token is missing from roster", () => {
    const lookup = makeLookup()
    assert.equal(isCollabFullyResolvedInRoster("rompy & Unknown", lookup), false)
  })

  it("returns false for a single artist name", () => {
    const lookup = makeLookup()
    assert.equal(isCollabFullyResolvedInRoster("rompy", lookup), false)
    assert.equal(isCollabFullyResolvedInRoster("Unknown Artist", lookup), false)
  })
})

describe("needsManualUnmappedMapping", () => {
  it("returns false for fully resolved collabs", () => {
    const lookup = makeLookup()
    assert.equal(needsManualUnmappedMapping("rompy & Лоло", lookup), false)
  })

  it("returns true for unknown single names and partial collabs", () => {
    const lookup = makeLookup()
    assert.equal(needsManualUnmappedMapping("Unknown Artist", lookup), true)
    assert.equal(needsManualUnmappedMapping("rompy & Unknown", lookup), true)
  })
})

describe("remapToMainArtistIds", () => {
  const mainByLinked = new Map([
    ["id-linked", "id-main"],
    ["id-linked-2", "id-main"],
  ])

  it("replaces a linked profile with its main", () => {
    assert.deepEqual(remapToMainArtistIds(["id-linked"], mainByLinked), ["id-main"])
  })

  it("leaves unlinked profiles alone", () => {
    assert.deepEqual(remapToMainArtistIds(["id-solo"], mainByLinked), ["id-solo"])
  })

  it("counts a main+linked collab once, not twice", () => {
    // «Главный & Привязанный» — один человек под двумя именами.
    assert.deepEqual(remapToMainArtistIds(["id-main", "id-linked"], mainByLinked), ["id-main"])
  })

  it("collapses two linked profiles of the same main into one entry", () => {
    assert.deepEqual(remapToMainArtistIds(["id-linked", "id-linked-2"], mainByLinked), ["id-main"])
  })

  it("keeps a genuine collab between different people as two entries", () => {
    assert.deepEqual(remapToMainArtistIds(["id-linked", "id-other"], mainByLinked), [
      "id-main",
      "id-other",
    ])
  })

  it("returns an empty list untouched", () => {
    assert.deepEqual(remapToMainArtistIds([], mainByLinked), [])
  })

  it("is a no-op when nothing is linked", () => {
    assert.deepEqual(remapToMainArtistIds(["a", "b"], new Map()), ["a", "b"])
  })
})
