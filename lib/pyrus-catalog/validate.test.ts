import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { catalogReleasesSchema } from "./validate"

const baseTrack = {
  id: "t1",
  trackName: "",
  mainArtists: "",
  isrc: "XX-XXX-YY-00001",
  previewStart: "00:30",
  musicAuthor: "Author Music",
  wordsAuthor: "Author Words",
  language: "1",
  explicit: false,
  isFocusTrack: false,
}

const baseRelease = {
  id: "r1",
  releaseType: "1" as const,
  releaseTitle: "Title",
  artists: "Artist",
  upc: "",
  originalReleaseDate: "2020-05-15",
  genre: "Hip-hop",
  tracks: [baseTrack],
}

describe("catalogReleasesSchema", () => {
  it("accepts valid single release", () => {
    const r = catalogReleasesSchema.safeParse([baseRelease])
    assert.equal(r.success, true)
  })

  it("rejects empty genre", () => {
    const r = catalogReleasesSchema.safeParse([{ ...baseRelease, genre: "" }])
    assert.equal(r.success, false)
  })

  it("accepts more than 5 releases (Buildin has no 5-slot cap)", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      ...baseRelease,
      id: `r${i}`,
    }))
    const r = catalogReleasesSchema.safeParse(six)
    assert.equal(r.success, true)
  })

  it("rejects more than 200 releases (safety ceiling)", () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      ...baseRelease,
      id: `r${i}`,
    }))
    const r = catalogReleasesSchema.safeParse(many)
    assert.equal(r.success, false)
  })

  it("rejects single with 2 tracks", () => {
    const r = catalogReleasesSchema.safeParse([
      { ...baseRelease, tracks: [baseTrack, { ...baseTrack, id: "t2" }] },
    ])
    assert.equal(r.success, false)
  })

  it("rejects language 0", () => {
    const r = catalogReleasesSchema.safeParse([
      {
        ...baseRelease,
        tracks: [{ ...baseTrack, language: "0" }],
      },
    ])
    assert.equal(r.success, false)
  })

  it("requires album track names", () => {
    const r = catalogReleasesSchema.safeParse([
      {
        ...baseRelease,
        releaseType: "2",
        tracks: [{ ...baseTrack, trackName: "", mainArtists: "A" }],
      },
    ])
    assert.equal(r.success, false)
  })
})
