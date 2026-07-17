import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  fileUploadUserMessage,
  formatZodIssuesForUser,
  mapPyrusApiErrorToUserMessage,
} from "./errors"

describe("catalog errors", () => {
  it("formatZodIssuesForUser prefixes release index", () => {
    const msg = formatZodIssuesForUser([
      { path: [3, "genre"], message: "укажите жанр" },
    ])
    assert.equal(msg, "Релиз 4: укажите жанр")
  })

  it("fileUploadUserMessage is user-friendly", () => {
    const msg = fileUploadUserMessage(2, "track.wav")
    assert.match(msg, /релиза 3/i)
    assert.match(msg, /track\.wav/)
    assert.doesNotMatch(msg, /guid|pyrus|error_code/i)
  })

  it("mapPyrusApiErrorToUserMessage includes field name for 245", () => {
    const msg = mapPyrusApiErrorToUserMessage(
      "invalid_value_format",
      "Cannot convert value X for the field with id 245 and name Жанр",
      3
    )
    assert.match(msg, /Жанр|формат/i)
  })
})
