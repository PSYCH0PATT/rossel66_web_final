/**
 * Проверки формата готовой книги.
 *
 * Файлы уходят артистам и открываются в настоящем Excel, поэтому здесь
 * проверяется не модель ExcelJS, а сам XML внутри xlsx: Excel отказывается
 * читать книгу, если порядок элементов расходится со схемой OOXML.
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import JSZip from "jszip"
import { buildArtistReport, type SummaryValues, type TrackRow } from "./workbook"

const TEMPLATE = "lib/templates/report-mendxza.xlsx"

const SUMMARY: SummaryValues = {
  quarterLabel: "4 квартал 2025 г.",
  periodLabel: "Период с 01.10.2025 по 31.12.2025",
  artistName: "PLVT",
  contract: "Договор №1 от 01.01.2024",
  fio: "Иванов Иван Иванович",
  fioShort: "Иванов И. И.",
  totalAmount: 12017.27,
  percentageText: "70%",
  finalAmount: 8412.09,
  approvalDate: new Date("2026-03-01T00:00:00Z"),
}

const TRACKS: TrackRow[] = [
  {
    trackCode: "FRX202448995",
    performer: "PLVT",
    name: "мёртвая бабка",
    album: "мёртвая бабка",
    quantity: 11706,
    amount: 300.13,
    share: 100,
  },
]

async function sheetXml(): Promise<string[]> {
  const buffer = await buildArtistReport(TEMPLATE, SUMMARY, TRACKS)
  // JSZip приходит вместе с ExcelJS — отдельная зависимость ради теста не нужна.
  const zip = await JSZip.loadAsync(buffer)
  const parts = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
  assert.ok(parts.length >= 2, `в книге должны быть сводный лист и лист артиста, найдено: ${parts}`)
  return Promise.all(parts.map((name) => zip.files[name].async("string")))
}

describe("buildArtistReport → формат книги", () => {
  it("порядок элементов в sheetPr соответствует схеме OOXML", async () => {
    // CT_SheetPr — это xsd:sequence: tabColor, outlinePr, pageSetUpPr.
    // ExcelJS 4.4.0 пишет pageSetUpPr раньше outlinePr (exceljs#1348), и Excel
    // на такой книге показывает «Ошибка в части содержимого».
    for (const xml of await sheetXml()) {
      const sheetPr = xml.match(/<sheetPr[^>]*>[\s\S]*?<\/sheetPr>/)?.[0]
      if (!sheetPr) continue
      const outline = sheetPr.indexOf("<outlinePr")
      const pageSetUp = sheetPr.indexOf("<pageSetUpPr")
      if (outline === -1 || pageSetUp === -1) continue
      assert.ok(
        outline < pageSetUp,
        `outlinePr должен идти перед pageSetUpPr, получено: ${sheetPr}`
      )
    }
  })

  it("в числовых ячейках нет пустых значений", async () => {
    // <c t="n"><v/></c> — тоже «Ошибка в части содержимого»: пустая строка не число.
    for (const xml of await sheetXml()) {
      assert.deepEqual(xml.match(/<v\s*\/>/g) ?? [], [], "пустой <v/> в ячейке")
      assert.deepEqual(
        xml.match(/<v>\s*(?:NaN|-?Infinity)\s*<\/v>/g) ?? [],
        [],
        "NaN/Infinity в значении ячейки"
      )
    }
  })
})
