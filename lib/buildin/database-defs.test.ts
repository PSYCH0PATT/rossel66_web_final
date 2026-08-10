import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BUILDIN_MAX_FILE_BYTES, titleProp, textProp, selectProp } from "./types"
import { BUILDIN_DATABASE_DEFS } from "./database-defs"
import { normalizeBuildinUploadContentType } from "./client"
import {
  ARTIST_OPS_ALLOWLIST,
  ARTIST_OPS_PROPERTY_KEYS,
  RELEASE_OPS_ALLOWLIST,
  RELEASE_OPS_PROPERTY_KEYS,
  ensureStableTrackIds,
  trackLocalId,
} from "./adapters/artists-releases"
import {
  REPORT_OPS_ALLOWLIST,
  REPORT_OPS_PROPERTY_KEYS,
} from "./adapters/ops-mirrors"
import {
  redactSubmissionPayloadForSharedInbox,
  submissionIdempotencyKey,
} from "./adapters/submissions"
import {
  SUBMISSION_STATUS_LABELS,
  labelFor,
} from "./labels"

describe("buildin types", () => {
  it("enforces 100MB per-file limit constant", () => {
    assert.equal(BUILDIN_MAX_FILE_BYTES, 100 * 1024 * 1024)
  })

  it("builds title/text/select property shapes", () => {
    assert.equal(titleProp("Hello").type, "title")
    assert.equal(textProp("x").type, "rich_text")
    assert.equal(selectProp("new").type, "select")
  })

  it("builds people and relation property shapes", async () => {
    const { peopleProp, relationProp } = await import("./types")
    assert.equal(peopleProp(["u1"]).type, "people")
    assert.deepEqual(peopleProp(["u1"]).people, [{ object: "user", id: "u1" }])
    assert.equal(relationProp(["p1"]).type, "relation")
    assert.deepEqual(relationProp(["p1"]).relation, [{ id: "p1" }])
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
  it("defines required databases including form queues", () => {
    const keys = [
      "submissions",
      "form_back_catalog",
      "form_release_upload",
      "form_distribution",
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

  it("questionnaires inbox covers contact and PII types only", () => {
    const tipo = BUILDIN_DATABASE_DEFS.submissions.properties["Тип"]
    assert.equal(tipo.type, "select")
    const names = tipo.select.options.map((o) => o.name)
    for (const t of ["Анкета РФ", "Анкета не РФ", "Обращение"]) {
      assert.ok(names.includes(t), t)
    }
    assert.equal(names.includes("catalog_upload"), false)
  })

  it("form queues have only artist, release title, application date, processed", () => {
    for (const key of [
      "form_back_catalog",
      "form_release_upload",
      "form_distribution",
    ] as const) {
      const props = BUILDIN_DATABASE_DEFS[key].properties
      assert.deepEqual(Object.keys(props), [
        "Артист",
        "Название релиза",
        "Дата заявки",
        "Обработана",
      ])
      assert.equal(props["Артист"].type, "title")
      assert.equal(props["Название релиза"].type, "rich_text")
      assert.equal(props["Дата заявки"].type, "date")
      assert.equal(props["Обработана"].type, "checkbox")
      for (const bad of [
        "Название",
        "Артисты",
        "Статус",
        "Email",
        "Telegram",
        "Контакт",
        "UPC",
        "Промо",
        "Технический ID",
        "Кол-во файлов",
        "Session ID",
      ]) {
        assert.equal(bad in props, false, `${key} must not have ${bad}`)
      }
    }
  })

  it("uses Russian submission workflow labels", () => {
    const status = BUILDIN_DATABASE_DEFS.submissions.properties["Статус"]
    assert.equal(status.type, "select")
    const names = status.select.options.map((o) => o.name)
    assert.ok(names.includes("Загружается"))
    assert.ok(names.includes("Новая"))
    assert.ok(names.includes("Ждём артиста"))
  })

  it("keeps archived submission_releases and submission_tracks defs", () => {
    for (const key of ["submission_releases", "submission_tracks"] as const) {
      const def = BUILDIN_DATABASE_DEFS[key]
      assert.ok(def, key)
      assert.ok(
        def.title.map((t) => t.plain_text || "").join("").includes("архив")
      )
    }
  })

  it("PII defs no longer require Payload JSON", () => {
    assert.equal(
      "Payload JSON" in BUILDIN_DATABASE_DEFS.pii_rf.properties,
      false
    )
    assert.equal(
      "Payload JSON" in BUILDIN_DATABASE_DEFS.pii_not_rf.properties,
      false
    )
  })

  it("moves diagnostic IDs to the end on CRM mirrors", () => {
    const artistKeys = Object.keys(BUILDIN_DATABASE_DEFS.artists.properties)
    assert.ok(artistKeys.indexOf("Локальный ID") > artistKeys.indexOf("Email"))
    const releaseKeys = Object.keys(BUILDIN_DATABASE_DEFS.releases.properties)
    assert.equal(releaseKeys[releaseKeys.length - 1], "Версия синхр.")
    const trackKeys = Object.keys(BUILDIN_DATABASE_DEFS.tracks.properties)
    assert.equal(trackKeys[trackKeys.length - 1], "ID заявки")
  })

  it("uses people assignee and relation schemas", () => {
    assert.equal(
      BUILDIN_DATABASE_DEFS.artists.properties.Ответственный.type,
      "people"
    )
    assert.equal(
      BUILDIN_DATABASE_DEFS.submissions.properties.Ответственный.type,
      "people"
    )
    assert.equal(
      BUILDIN_DATABASE_DEFS.releases.properties.АртистRel.type,
      "relation"
    )
    assert.equal(
      BUILDIN_DATABASE_DEFS.tracks.properties.РелизRel.type,
      "relation"
    )
    assert.equal(
      BUILDIN_DATABASE_DEFS.pii_rf.properties.ЗаявкаRel.type,
      "relation"
    )
  })

  it("uses Russian property keys on CRM mirrors", () => {
    const artists = BUILDIN_DATABASE_DEFS.artists.properties
    assert.ok("Юзернейм" in artists)
    assert.ok("Операционный статус" in artists)
    assert.equal("Username" in artists, false)
    assert.equal("Ops Status" in artists, false)

    const releases = BUILDIN_DATABASE_DEFS.releases.properties
    assert.ok("Имя артиста" in releases)
    assert.ok("Авто-статус" in releases)
    assert.equal("Artist Name" in releases, false)

    const tracks = BUILDIN_DATABASE_DEFS.tracks.properties
    assert.ok("Мат" in tracks)
    assert.ok("Локальный ID релиза" in tracks)
    assert.equal("Explicit" in tracks, false)

    const reports = BUILDIN_DATABASE_DEFS.reports.properties
    assert.ok("Квартал" in reports)
    assert.ok("URL файла" in reports)
    assert.equal("Quarter" in reports, false)
  })
})

describe("ops allowlists and ownership", () => {
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

  it("lists Buildin ops property keys for partial PATCH exclusion", () => {
    assert.ok(ARTIST_OPS_PROPERTY_KEYS.includes("Операционный статус"))
    assert.ok(RELEASE_OPS_PROPERTY_KEYS.includes("Ответственный"))
    assert.ok(REPORT_OPS_PROPERTY_KEYS.includes("Заметки"))
  })
})

describe("PII redaction and idempotency", () => {
  it("redacts passport/bank from shared inbox payload", () => {
    const redacted = redactSubmissionPayloadForSharedInbox("data_rf", {
      nickname: "Artist",
      passportSeriesNumber: "1234 567890",
      bankAccountNumber: "40817810",
      email: "a@b.c",
    })
    assert.equal(redacted.nickname, "Artist")
    assert.equal(redacted.passportSeriesNumber, undefined)
    assert.equal(redacted.bankAccountNumber, undefined)
    assert.equal(redacted.piiStoredIn, "pii_rf")
  })

  it("leaves non-PII form payloads intact", () => {
    const payload = { upc: "1", title: "Song" }
    assert.deepEqual(
      redactSubmissionPayloadForSharedInbox("release_upload", payload),
      payload
    )
  })

  it("uses stable submission:<id> idempotency key", () => {
    assert.equal(submissionIdempotencyKey("abc"), "submission:abc")
  })
})

describe("track id stability", () => {
  it("prefers explicit track id, then isrc, then index", () => {
    assert.equal(trackLocalId("r1", { id: "t9" }, 0), "t9")
    assert.equal(trackLocalId("r1", { isrc: "ISRC1" }, 2), "r1:ISRC1")
    assert.equal(trackLocalId("r1", {}, 3), "r1:3")
  })

  it("ensureStableTrackIds fills missing ids without changing existing", () => {
    const out = ensureStableTrackIds("rel", [
      { id: "keep", title: "A" },
      { isrc: "X", title: "B" },
      { title: "C" },
    ])
    assert.equal(out[0].id, "keep")
    assert.equal(out[1].id, "rel:X")
    assert.equal(out[2].id, "rel:2")
  })
})

describe("labels", () => {
  it("maps machine submission status to Russian", () => {
    assert.equal(labelFor(SUBMISSION_STATUS_LABELS, "new"), "Новая")
    assert.equal(labelFor(SUBMISSION_STATUS_LABELS, "needs_info"), "Ждём артиста")
  })
})
