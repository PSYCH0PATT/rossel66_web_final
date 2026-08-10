import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FORM_TYPE_LABELS,
  genreLabel,
  languageLabel,
  releaseTypeLabel,
  sourceLabel,
  yesNoLabel,
} from "./labels"
import {
  payloadSummaryLines,
  genreForSingleRelease,
  releaseTypeForSingle,
} from "./form-application-page"
import { formTypeToDatabaseKey } from "./env"

describe("form labels", () => {
  it("maps form types to Russian ops labels", () => {
    assert.equal(FORM_TYPE_LABELS.catalog_upload, "Бэк-каталог")
    assert.equal(FORM_TYPE_LABELS.release_upload, "Загрузка релиза")
    assert.equal(FORM_TYPE_LABELS.distribution, "Дистрибуция")
  })

  it("resolves release types per form family", () => {
    assert.equal(releaseTypeLabel("catalog_upload", "1"), "Сингл")
    assert.equal(releaseTypeLabel("catalog_upload", "2"), "Альбом")
    assert.equal(releaseTypeLabel("release_upload", "4"), "Альбом (8 и более треков)")
    assert.equal(
      releaseTypeLabel("distribution", "2"),
      "Макси-сингл (2-3 трека)"
    )
  })

  it("resolves genre including otherGenre", () => {
    assert.equal(genreLabel("1"), "Hip Hop/Rap")
    assert.equal(genreLabel("7", "Indie"), "Другой: Indie")
    assert.equal(genreLabel("Hip-hop"), "Hip-hop")
  })

  it("resolves language and yes/no", () => {
    assert.equal(languageLabel("1"), "Русский")
    assert.equal(yesNoLabel("2"), "Нет")
    assert.equal(sourceLabel("site"), "Сайт")
  })
})

describe("form routing", () => {
  it("routes formType to dedicated queues", () => {
    assert.equal(formTypeToDatabaseKey("catalog_upload"), "form_back_catalog")
    assert.equal(formTypeToDatabaseKey("release_upload"), "form_release_upload")
    assert.equal(formTypeToDatabaseKey("distribution"), "form_distribution")
    assert.equal(formTypeToDatabaseKey("contact"), "submissions")
    assert.equal(formTypeToDatabaseKey("data_rf"), "submissions")
  })
})

describe("application page helpers", () => {
  it("keeps promo payload lines", () => {
    const lines = payloadSummaryLines({
      submitToPromo: "1",
      artistInfo: "Bio here",
      vkLink: "https://vk.com/x",
      otherComments: "Please rush",
      releaseType: "1",
    })
    assert.ok(lines.some((l) => l.includes("Отправить в промо")))
    assert.ok(lines.some((l) => l.includes("Bio here")))
    assert.ok(lines.some((l) => l.includes("Please rush")))
    assert.equal(
      lines.some((l) => l.toLowerCase().includes("releasetype")),
      false
    )
  })

  it("reads single-release fields (not for catalog list row)", () => {
    const manifest = {
      formType: "release_upload" as const,
      title: "T",
      contact: null,
      contactTelegram: null,
      payload: {},
      files: [],
      releases: [
        {
          releaseTitle: "R",
          artists: "A",
          releaseType: "4",
          upc: "123456789012",
          genre: "Hip-hop",
          otherGenre: "",
          releaseDate: "2024-01-01",
          tracks: [
            {
              trackTitle: "T1",
              artists: "A",
              isrc: "USRC1",
              language: "1",
              explicit: false,
              focus: false,
              previewStart: "",
              musicAuthor: "",
              wordsAuthor: "",
            },
          ],
        },
      ],
    }
    assert.equal(genreForSingleRelease(manifest), "Hip-hop")
    assert.equal(
      releaseTypeForSingle(manifest),
      "Альбом (8 и более треков)"
    )
  })
})
