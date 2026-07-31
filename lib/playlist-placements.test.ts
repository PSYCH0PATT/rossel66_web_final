import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  earliestObservationDate,
  parseObservationDate,
  playlistPlacementKey,
  resolvePlacementFirstSeen,
  trackTitleFromParsed,
} from "@/lib/playlist-placements"

describe("playlistPlacementKey", () => {
  it("prefers ISRC over title", () => {
    const a = playlistPlacementKey({
      playlistUrl: "https://music.yandex.ru/playlist/1",
      isrc: "USRC17607839",
      artistName: "Artist",
      trackTitle: "Song A",
    })
    const b = playlistPlacementKey({
      playlistUrl: "https://music.yandex.ru/playlist/1",
      isrc: "usrc17607839",
      artistName: "Other",
      trackTitle: "Different",
    })
    assert.equal(a, b)
    assert.match(a, /::isrc:USRC17607839$/)
  })

  it("falls back to normalized artist+title", () => {
    const a = playlistPlacementKey({
      playlistUrl: "https://example.com/p",
      artistName: "  ROSSEL  ",
      trackTitle: "Track  One",
    })
    const b = playlistPlacementKey({
      playlistUrl: "HTTPS://EXAMPLE.COM/P",
      artistName: "rossel",
      trackTitle: "track one",
    })
    assert.equal(a, b)
    assert.match(a, /::track:rossel::track one$/)
  })

  it("keeps different tracks distinct without ISRC", () => {
    const a = playlistPlacementKey({
      playlistUrl: "https://example.com/p",
      artistName: "A",
      trackTitle: "One",
    })
    const b = playlistPlacementKey({
      playlistUrl: "https://example.com/p",
      artistName: "A",
      trackTitle: "Two",
    })
    assert.notEqual(a, b)
  })
})

describe("trackTitleFromParsed", () => {
  it("uses trackTitle when present", () => {
    assert.equal(
      trackTitleFromParsed({ trackTitle: "Hello", titleArtist: "A - Hello" }),
      "Hello"
    )
  })

  it("parses titleArtist fallback", () => {
    assert.equal(
      trackTitleFromParsed({ trackTitle: "", titleArtist: "Artist - Song" }),
      "Song"
    )
  })
})

describe("observation dates", () => {
  it("parseObservationDate accepts YYYY-MM-DD and strips time", () => {
    assert.equal(parseObservationDate("2026-05-28"), "2026-05-28")
    assert.equal(parseObservationDate("2026-05-28T12:00:00Z"), "2026-05-28")
    assert.equal(parseObservationDate(" 2026-07-17 "), "2026-07-17")
    assert.equal(parseObservationDate("bogus"), null)
    assert.equal(parseObservationDate(""), null)
    assert.equal(parseObservationDate(null), null)
  })

  it("earliestObservationDate picks the minimum valid day", () => {
    assert.equal(
      earliestObservationDate("2026-07-23", "2026-05-28", "nope", null),
      "2026-05-28"
    )
    assert.equal(earliestObservationDate(undefined, null, ""), null)
  })

  it("resolvePlacementFirstSeen prefers CSV / playlist over today", () => {
    assert.equal(
      resolvePlacementFirstSeen({
        trackParsedDate: "2026-05-28",
        playlistFirstSeenDate: "2026-06-01",
        today: "2026-07-31",
      }),
      "2026-05-28"
    )
  })

  it("resolvePlacementFirstSeen never moves later than existing", () => {
    assert.equal(
      resolvePlacementFirstSeen({
        existingFirstSeen: "2026-05-01",
        trackParsedDate: "2026-07-01",
        today: "2026-07-31",
      }),
      "2026-05-01"
    )
  })

  it("resolvePlacementFirstSeen transfers legacy title-key date on ISRC rekey", () => {
    assert.equal(
      resolvePlacementFirstSeen({
        legacyTitleFirstSeen: "2026-05-28",
        trackParsedDate: "2026-07-23",
        today: "2026-07-31",
      }),
      "2026-05-28"
    )
  })

  it("resolvePlacementFirstSeen seeds from playlist when no other signal", () => {
    assert.equal(
      resolvePlacementFirstSeen({
        playlistFirstSeenDate: "2026-05-29",
        today: "2026-07-31",
      }),
      "2026-05-29"
    )
  })
})

describe("slim Buildin playlist schema", () => {
  it("exposes only five placement fields", async () => {
    const { BUILDIN_DATABASE_DEFS } = await import("@/lib/buildin/database-defs")
    const keys = Object.keys(BUILDIN_DATABASE_DEFS.playlists.properties).sort()
    assert.deepEqual(keys, [
      "URL",
      "Артист",
      "Впервые обнаружен",
      "Плейлист",
      "Трек",
    ])
  })
})
