import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BUILDIN_MAX_FILE_BYTES, titleProp, textProp, selectProp } from "./types"
import { BUILDIN_DATABASE_DEFS } from "./database-defs"
import { normalizeBuildinUploadContentType } from "./client"
import {
  ARTIST_OPS_ALLOWLIST,
  RELEASE_OPS_ALLOWLIST,
} from "./adapters/artists-releases"
import { REPORT_OPS_ALLOWLIST } from "./adapters/ops-mirrors"

describe("buildin types", () => {
  it("enforces 100MB per-file limit constant", () => {
    assert.equal(BUILDIN_MAX_FILE_BYTES, 100 * 1024 * 1024)
  })

  it("builds title/text/select property shapes", () => {
    assert.equal(titleProp("Hello").type, "title")
    assert.equal(textProp("x").type, "rich_text")
    assert.equal(selectProp("new").type, "select")
  })
})

describe("normalizeBuildinUploadContentType", () => {
  it("keeps whitelisted MIME types", () => {
    assert.equal(normalizeBuildinUploadContentType("audio/wav"), "audio/wav")
    assert.equal(normalizeBuildinUploadContentType("image/jpeg"), "image/jpeg")
  })

  it("maps by filename extension when MIME is empty or unknown", () => {
    assert.equal(normalizeBuildinUploadContentType("", "track.wav"), "audio/wav")
    assert.equal(
      normalizeBuildinUploadContentType("audio/x-wav", "a.wav"),
      "audio/wav"
    )
    assert.equal(
      normalizeBuildinUploadContentType("binary/octet-stream", "x.bin"),
      "application/octet-stream"
    )
  })
})

describe("buildin database defs", () => {
  it("defines all required databases with a title property", () => {
    const keys = [
      "submissions",
      "artists",
      "releases",
      "tracks",
      "reports",
      "playlists",
      "automation_runs",
      "pii_rf",
      "pii_not_rf",
      "activity",
      "playlist_history",
    ] as const

    for (const key of keys) {
      const def = BUILDIN_DATABASE_DEFS[key]
      assert.ok(def, key)
      assert.ok(Array.isArray(def.title) && def.title.length > 0, `${key} title`)
      const props = Object.values(def.properties)
      assert.ok(
        props.some((p) => p.type === "title"),
        `${key} must have title property`
      )
    }
  })

  it("submissions form types cover all five flows", () => {
    const tipo = BUILDIN_DATABASE_DEFS.submissions.properties["Тип"]
    assert.equal(tipo.type, "select")
    const names = tipo.select.options.map((o) => o.name)
    for (const t of [
      "release_upload",
      "catalog_upload",
      "distribution",
      "data_rf",
      "data_not_rf",
    ]) {
      assert.ok(names.includes(t), t)
    }
  })
})

describe("ops allowlists", () => {
  it("never includes financial or auth fields", () => {
    const forbidden = [
      "password",
      "role",
      "totalAmount",
      "isPaid",
      "isSigned",
      "isAcknowledged",
      "status",
      "fio",
      "percentage",
      "contract",
    ]
    const all = [
      ...ARTIST_OPS_ALLOWLIST,
      ...RELEASE_OPS_ALLOWLIST,
      ...REPORT_OPS_ALLOWLIST,
    ]
    for (const f of forbidden) {
      assert.ok(!all.includes(f as never), f)
    }
  })
})
