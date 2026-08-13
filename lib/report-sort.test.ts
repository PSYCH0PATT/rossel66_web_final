import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildReportOrderBySql, isReportSortField, REPORT_SORT_FIELDS } from "./report-sort"

const FALLBACK = `year DESC, "uploadedAt" DESC`

describe("buildReportOrderBySql", () => {
  it("falls back when sort is missing", () => {
    assert.equal(buildReportOrderBySql(null, null, FALLBACK), `${FALLBACK}, id ASC`)
  })

  it("falls back on a field outside the whitelist", () => {
    assert.equal(buildReportOrderBySql("filePath", "asc", FALLBACK), `${FALLBACK}, id ASC`)
  })

  it("never lets a raw query value reach the SQL", () => {
    const injection = `artistName"; DROP TABLE "Report"; --`
    const sql = buildReportOrderBySql(injection, "asc", FALLBACK)
    assert.equal(sql, `${FALLBACK}, id ASC`)
    assert.ok(!sql.includes("DROP"))
  })

  it("defaults to DESC and only accepts an explicit asc", () => {
    assert.match(buildReportOrderBySql("totalAmount", null, FALLBACK), /DESC NULLS LAST/)
    assert.match(buildReportOrderBySql("totalAmount", "ASC", FALLBACK), /DESC NULLS LAST/)
    assert.match(buildReportOrderBySql("totalAmount", "asc", FALLBACK), /ASC NULLS LAST/)
  })

  it("appends id as a tiebreaker so pagination stays stable", () => {
    for (const field of REPORT_SORT_FIELDS) {
      assert.ok(
        buildReportOrderBySql(field, "asc", FALLBACK).endsWith(", id ASC"),
        `${field} lost the tiebreaker`
      )
    }
  })

  it("sorts text case-insensitively and treats missing numbers as zero", () => {
    assert.match(buildReportOrderBySql("artistName", "asc", FALLBACK), /lower\(trim\(COALESCE/)
    assert.match(buildReportOrderBySql("totalPlays", "asc", FALLBACK), /COALESCE\("totalPlays", 0\)/)
  })
})

describe("isReportSortField", () => {
  it("accepts every advertised field", () => {
    for (const field of REPORT_SORT_FIELDS) assert.equal(isReportSortField(field), true)
  })

  it("rejects prototype keys", () => {
    assert.equal(isReportSortField("constructor"), false)
    assert.equal(isReportSortField("toString"), false)
    assert.equal(isReportSortField(null), false)
  })
})
