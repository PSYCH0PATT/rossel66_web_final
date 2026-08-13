import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canViewArtistCabinet, validateLinkPair, type LinkCandidate } from "./artist-links"

const artist = (id: string, mainArtistId: string | null = null): LinkCandidate => ({
  id,
  role: "artist",
  mainArtistId,
})

describe("validateLinkPair", () => {
  it("allows a plain artist-to-artist link", () => {
    assert.deepEqual(validateLinkPair(artist("main"), artist("linked"), 0), { ok: true })
  })

  it("rejects a missing profile on either side", () => {
    assert.equal(validateLinkPair(null, artist("linked"), 0).ok, false)
    assert.equal(validateLinkPair(artist("main"), null, 0).ok, false)
  })

  it("rejects self-linking", () => {
    const result = validateLinkPair(artist("same"), artist("same"), 0)
    assert.equal(result.ok, false)
  })

  it("rejects admins on either side", () => {
    const admin = { id: "admin", role: "admin", mainArtistId: null }
    assert.equal(validateLinkPair(admin, artist("linked"), 0).ok, false)
    assert.equal(validateLinkPair(artist("main"), admin, 0).ok, false)
  })

  it("refuses to build a second level under an already-linked main", () => {
    const result = validateLinkPair(artist("main", "grandparent"), artist("linked"), 0)
    assert.equal(result.ok, false)
  })

  it("refuses to link a profile that is itself a main", () => {
    const result = validateLinkPair(artist("main"), artist("linked"), 2)
    assert.equal(result.ok, false)
  })

  it("rejects a profile already linked elsewhere", () => {
    const result = validateLinkPair(artist("main"), artist("linked", "someone-else"), 0)
    assert.equal(result.ok, false)
  })

  it("treats relinking to the same main as valid (idempotent)", () => {
    assert.deepEqual(validateLinkPair(artist("main"), artist("linked", "main"), 0), { ok: true })
  })
})

describe("canViewArtistCabinet", () => {
  const main = { id: "main", role: "artist" }
  const other = { id: "other", role: "artist" }

  it("lets an artist into their own cabinet", () => {
    assert.equal(canViewArtistCabinet(main, { id: "main" }), true)
  })

  it("lets a main into a linked profile's cabinet", () => {
    assert.equal(canViewArtistCabinet(main, { id: "linked", mainArtistId: "main" }), true)
  })

  it("does not let a linked profile into the main's cabinet", () => {
    const linked = { id: "linked", role: "artist" }
    assert.equal(canViewArtistCabinet(linked, { id: "main", mainArtistId: null }), false)
  })

  it("does not let an unrelated artist in", () => {
    assert.equal(canViewArtistCabinet(other, { id: "linked", mainArtistId: "main" }), false)
  })

  it("does not treat two profiles of the same main as siblings", () => {
    const sibling = { id: "sibling", role: "artist" }
    assert.equal(canViewArtistCabinet(sibling, { id: "linked", mainArtistId: "main" }), false)
  })

  it("lets admins everywhere and blocks anonymous", () => {
    assert.equal(canViewArtistCabinet({ id: "a", role: "admin" }, { id: "anyone" }), true)
    assert.equal(canViewArtistCabinet(null, { id: "anyone" }), false)
  })

  it("is not fooled by an undefined link", () => {
    assert.equal(canViewArtistCabinet(main, { id: "stranger", mainArtistId: undefined }), false)
  })
})
