import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { attachmentContentDisposition } from "./content-disposition"
import { fileNameFromContentDisposition, quarterArchiveName } from "./download-file"

describe("fileNameFromContentDisposition", () => {
  it("returns null when the header is absent", () => {
    assert.equal(fileNameFromContentDisposition(null), null)
  })

  it("prefers filename* so Cyrillic survives instead of arriving transliterated", () => {
    const header = attachmentContentDisposition("Отчёт Q1.xlsx")
    assert.equal(fileNameFromContentDisposition(header), "Отчёт Q1.xlsx")
  })

  it("falls back to the ASCII filename when filename* is missing", () => {
    assert.equal(
      fileNameFromContentDisposition('attachment; filename="report.xlsx"'),
      "report.xlsx"
    )
  })

  it("survives a broken percent-encoding by using the ASCII fallback", () => {
    const header = `attachment; filename="report.xlsx"; filename*=UTF-8''%E0%A4%A`
    assert.equal(fileNameFromContentDisposition(header), "report.xlsx")
  })

  it("reads an unquoted filename", () => {
    assert.equal(fileNameFromContentDisposition("attachment; filename=a.zip"), "a.zip")
  })
})

describe("quarterArchiveName", () => {
  it("includes the year so archives of different years stay distinguishable", () => {
    assert.equal(quarterArchiveName("Q1", 2026), "Q1_2026_reports.zip")
  })

  it("omits the year when it is unknown", () => {
    assert.equal(quarterArchiveName("Q1", null), "Q1_reports.zip")
  })
})
