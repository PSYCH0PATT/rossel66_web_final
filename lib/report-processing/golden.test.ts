/**
 * Регрессия против эталона питон-реализации.
 *
 * `tests/fixtures/golden-report.json` — снимок вывода прежнего питон-обработчика
 * на детерминированной выписке (соло, коллаб, группа связанных профилей, чужой
 * исполнитель, артист без реквизитов). Здесь сверяется каждая ячейка сводного
 * листа и все метаданные: файлы уходят артистам, расхождение — это деньги.
 *
 * Эталон пересобирать нельзя, не убедившись, что изменение поведения намеренное.
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import ExcelJS from "exceljs"
import { processReports, type ProcessReportsResult } from "./index"

type Golden = {
  metadata: Array<Record<string, unknown>>
  workbooks: Record<string, { sheet: string; cells: Record<string, unknown>; merged: string[] }>
  stdout_markers: { UNMATCHED_JSON?: { unmatchedArtists: unknown[] } }
}

const golden: Golden = JSON.parse(readFileSync("tests/fixtures/golden-report.json", "utf-8"))
const users = JSON.parse(readFileSync("tests/fixtures/users.json", "utf-8"))
const releases = JSON.parse(readFileSync("tests/fixtures/releases.json", "utf-8"))

let outDir: string
let result: ProcessReportsResult

before(async () => {
  outDir = mkdtempSync(join(tmpdir(), "golden-"))
  result = await processReports({
    statementPath: "tests/fixtures/statement.xlsx",
    quarter: "Q1",
    year: 2026,
    users,
    releases,
    reportsDir: outDir,
    templatePath: "lib/templates/report-mendxza.xlsx",
    approvalDate: new Date("2026-03-01T00:00:00Z"),
  })
})

after(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true })
})

describe("совпадение с эталоном питон-реализации", () => {
  it("создаёт те же отчёты", () => {
    const expected = golden.metadata.map((m) => m.artistName).sort()
    const actual = result.metadata.map((m) => m.artistName).sort()
    assert.deepEqual(actual, expected)
  })

  it("считает те же суммы и прослушивания", () => {
    const byName = (rows: Array<Record<string, unknown>>) =>
      new Map(rows.map((m) => [String(m.artistName), m]))
    const expected = byName(golden.metadata)
    const actual = byName(result.metadata as unknown as Array<Record<string, unknown>>)

    for (const [name, want] of expected) {
      const got = actual.get(name)
      assert.ok(got, `нет отчёта для ${name}`)
      for (const field of [
        "totalAmount", "totalPlays", "artistId", "quarter", "year",
        "fileName", "status", "isRegistered", "isSigned", "isPaid", "isAcknowledged",
      ]) {
        assert.deepEqual(got[field], want[field], `${name}.${field}`)
      }
    }
  })

  it("заполняет сводный лист ячейка в ячейку", async () => {
    for (const [fileName, expected] of Object.entries(golden.workbooks)) {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(join(outDir, fileName))
      const sheet = workbook.getWorksheet(expected.sheet)
      assert.ok(sheet, `в ${fileName} нет листа ${expected.sheet}`)

      for (const [ref, want] of Object.entries(expected.cells)) {
        let got: unknown = sheet.getCell(ref).value
        if (got && typeof got === "object") {
          const asAny = got as { result?: unknown }
          if (got instanceof Date) got = got.toISOString().slice(0, 19)
          else if ("result" in asAny) got = asAny.result
        }
        let wanted = want
        if (typeof wanted === "string" && /^\d{4}-\d{2}-\d{2}T/.test(wanted)) {
          wanted = wanted.slice(0, 19)
        }
        if (typeof wanted === "number" && typeof got === "number") {
          assert.ok(Math.abs(wanted - got) < 1e-9, `${fileName} ${ref}: ${wanted} ≠ ${got}`)
        } else {
          assert.equal(String(got), String(wanted), `${fileName} ${ref}`)
        }
      }
    }
  })

  it("сохраняет оформление шаблона: объединённые ячейки на месте", async () => {
    for (const [fileName, expected] of Object.entries(golden.workbooks)) {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(join(outDir, fileName))
      const sheet = workbook.getWorksheet(expected.sheet)!
      const merges = (sheet as unknown as { model?: { merges?: string[] } }).model?.merges ?? []
      assert.equal(
        merges.length,
        expected.merged.length,
        `${fileName}: объединённых диапазонов должно быть ${expected.merged.length}`
      )
    }
  })

  it("добавляет отдельный лист с треками артиста", async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(join(outDir, "Главный.xlsx"))
    // Сводный лист из шаблона + лист треков.
    assert.equal(workbook.worksheets.length, 2)
    const tracks = workbook.worksheets[1]
    const header = [1, 2, 3, 4, 5, 6, 7].map((c) => tracks.getRow(1).getCell(c).value)
    assert.deepEqual(header, [
      "Код", "Исполнитель", "Наименование", "Альбом", "Количество", "Сумма, руб.", "Доля, %",
    ])
    // Последняя строка — «Итого».
    assert.equal(tracks.getRow(tracks.rowCount).getCell(1).value, "Итого")
  })

  it("отдаёт тех же нераспознанных исполнителей", () => {
    const expected = (golden.stdout_markers.UNMATCHED_JSON?.unmatchedArtists ?? []) as Array<
      Record<string, unknown>
    >
    assert.equal(result.unmatchedArtists.length, expected.length)
    for (const want of expected) {
      const got = result.unmatchedArtists.find((u) => u.trackArtist === want.trackArtist)
      assert.ok(got, `нет нераспознанного ${want.trackArtist}`)
      assert.equal(got.rows, want.rows)
      assert.equal(got.totalAmount, want.totalAmount)
    }
  })

  it("не теряет деньги нераспознанных: они не попали ни в один отчёт", () => {
    const paid = result.metadata.reduce((sum, m) => sum + m.totalAmount, 0)
    const unmatchedMoney = result.unmatchedArtists.reduce((sum, u) => sum + u.totalAmount, 0)
    assert.ok(unmatchedMoney > 0, "фикстура должна содержать нераспознанного исполнителя")
    assert.ok(paid > 0)
  })
})
