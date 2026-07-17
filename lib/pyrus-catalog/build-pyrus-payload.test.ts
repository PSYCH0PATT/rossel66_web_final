import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildPyrusCatalogFields } from "./build-pyrus-payload"
import type { CatalogRelease, CatalogUploadGuids } from "./types"

const fourthSingle: CatalogRelease = {
  id: "r4",
  releaseType: "1",
  releaseTitle: "Test Single",
  artists: "Artist",
  upc: "123",
  originalReleaseDate: "2020-05-15",
  genre: "Hip-hop",
  tracks: [
    {
      id: "t1",
      trackName: "",
      mainArtists: "",
      isrc: "XX-XXX-YY-00001",
      previewStart: "00:30",
      musicAuthor: "Music Author",
      wordsAuthor: "Words Author",
      language: "1",
      explicit: false,
      isFocusTrack: false,
    },
  ],
}

const guids: CatalogUploadGuids = {
  releases: [
    { coverGuid: null, trackGuids: [] },
    { coverGuid: null, trackGuids: [] },
    { coverGuid: null, trackGuids: [] },
    {
      coverGuid: "cover-guid",
      trackGuids: [{ audioGuid: "audio-guid", lyricsGuid: null }],
    },
    { coverGuid: null, trackGuids: [] },
  ],
}

describe("buildPyrusCatalogFields", () => {
  it("4th single maps genre to 245 and date to 175 (regression #175)", () => {
    const releases = [
      fourthSingle,
      fourthSingle,
      fourthSingle,
      fourthSingle,
    ]
    const fields = buildPyrusCatalogFields(releases, guids)

    const genreFields = fields.filter((f) => f.id === 245)
    const dateFields = fields.filter((f) => f.id === 175)

    assert.equal(genreFields.length, 1)
    assert.equal(genreFields[0].value, "Hip-hop")
    assert.equal(dateFields.length, 1)
    assert.equal(dateFields[0].value, "2020-05-15")

    const wrongGenreOn175 = fields.filter((f) => f.id === 175 && f.value === "Hip-hop")
    assert.equal(wrongGenreOn175.length, 0)
  })

  it("sets release type choice_id for first release", () => {
    const fields = buildPyrusCatalogFields([fourthSingle], {
      releases: [
        {
          coverGuid: "c",
          trackGuids: [{ audioGuid: "a", lyricsGuid: null }],
        },
      ],
    })
    const typeField = fields.find((f) => f.id === 45)
    assert.deepEqual(typeField?.value, { choice_id: 1 })
  })
})
