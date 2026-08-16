/**
 * Чтение выписки дистрибьютора (XLSX).
 *
 * Порт `_load_statement_df` и соседей: алиасы колонок, поиск строки заголовка,
 * маппинг по буквам колонок из UI, приведение чисел.
 */
import ExcelJS from "exceljs"

export const CANONICAL_FROM_MAPPING: Record<string, string> = {
  isrc_column: "Код",
  artist_column: "Исполнитель",
  track_name_column: "Наименование",
  album_name_column: "Альбом",
  plays_column: "Количество",
  amount_column: "Сумма, руб.",
}

export const REQUIRED_STATEMENT_COLUMNS = Object.values(CANONICAL_FROM_MAPPING)

const COLUMN_ALIASES: Record<string, string[]> = {
  Код: ["Код", "код", "Код трека", "ISRC", "isrc"],
  Исполнитель: ["Исполнитель", "исполнитель", "Artist"],
  Наименование: ["Наименование", "наименование", "Название", "Трек"],
  Альбом: ["Альбом", "альбом", "Release"],
  Количество: ["Количество", "количество", "Кол-во", "Прослушивания"],
  "Сумма, руб.": [
    "Сумма, руб.", "Сумма,руб.", "Сумма (руб.)", "Сумма руб.", "Сумма руб",
    "Сумма, руб", "Сумма", "сумма, руб.", "Сумма (руб)",
  ],
}

export type StatementRow = Record<string, unknown>

/** Значение ячейки как строка: NaN/пусто → "". */
function cellStr(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number" && Number.isNaN(value)) return ""
  if (typeof value === "object") {
    // ExcelJS отдаёт формулы и rich text объектами.
    const asAny = value as { result?: unknown; richText?: Array<{ text: string }>; text?: string }
    if (asAny.richText) return asAny.richText.map((t) => t.text).join("").trim()
    if (asAny.text !== undefined) return String(asAny.text).trim()
    if (asAny.result !== undefined) return String(asAny.result).trim()
  }
  return String(value).trim()
}

/** Буква колонки Excel → индекс с нуля. A=0, AA=26. */
export function columnLetterToIndex(letter: string | undefined | null): number | null {
  if (!letter || typeof letter !== "string") return null
  const normalized = letter.trim().toUpperCase()
  // Только латиница: питон полагался на str.isalpha(), который пропускал
  // кириллицу и давал мусорный индекс. Здесь это явно отсечено.
  if (!/^[A-Z]+$/.test(normalized)) return null
  let index = 0
  for (const char of normalized) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function normalizeColumnName(raw: unknown): string | null {
  const value = cellStr(raw)
  if (!value) return null
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(value) || value === canonical) return canonical
  }
  return null
}

/** Насколько строка похожа на заголовок таблицы. */
function rowHeaderScore(row: unknown[], columnMapping?: Record<string, string> | null): number {
  const flatAliases = new Set<string>()
  for (const aliases of Object.values(COLUMN_ALIASES)) {
    for (const alias of aliases) flatAliases.add(alias.toLowerCase())
  }

  let score = 0
  for (const value of row) {
    const cell = cellStr(value).toLowerCase()
    if (!cell) continue
    if (flatAliases.has(cell)) {
      score += 2
    } else {
      for (const alias of flatAliases) {
        if (alias.length > 3 && (cell.includes(alias) || alias.includes(cell))) {
          score += 1
          break
        }
      }
    }
  }

  if (columnMapping) {
    for (const field of Object.keys(CANONICAL_FROM_MAPPING)) {
      const index = columnLetterToIndex(columnMapping[field])
      if (index === null || index >= row.length) continue
      const cell = cellStr(row[index]).toLowerCase()
      // «Числоподобные» ячейки заголовком не считаются.
      const stripped = cell.replace(/[.,-]/g, "")
      if (cell && !(stripped.length > 0 && /^\d+$/.test(stripped))) score += 1
    }
  }
  return score
}

function findHeaderRow(
  rows: unknown[][],
  columnMapping?: Record<string, string> | null,
  minScore = 3
): number | null {
  let bestRow: number | null = null
  let bestScore = 0
  for (let i = 0; i < Math.min(40, rows.length); i++) {
    const score = rowHeaderScore(rows[i], columnMapping)
    if (score > bestScore) {
      bestScore = score
      bestRow = i
    }
  }
  return bestScore >= minScore ? bestRow : null
}

/** Числовые колонки: нечисло → 0, как `pd.to_numeric(errors='coerce').fillna(0)`. */
function coerceNumeric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined) return 0
  if (typeof value === "object") {
    const result = (value as { result?: unknown }).result
    if (typeof result === "number") return Number.isFinite(result) ? result : 0
  }
  const text = String(value).trim()
  if (text === "") return 0
  // Пробелы и запятые НЕ чинятся намеренно: pandas такие строки тоже давал 0,
  // и молчаливое «улучшение» здесь изменило бы суммы отчётов.
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : 0
}

/** Все строки листа как массив массивов (индексы колонок с нуля). */
function sheetToMatrix(sheet: ExcelJS.Worksheet): unknown[][] {
  const matrix: unknown[][] = []
  const width = Math.max(sheet.columnCount, 1)
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = []
    for (let c = 1; c <= width; c++) values.push(row.getCell(c).value)
    matrix.push(values)
  })
  return matrix
}

export type LoadStatementResult = { rows: StatementRow[] }

export async function loadStatement(
  path: string,
  columnMapping?: Record<string, string> | null
): Promise<LoadStatementResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)

  // Лист выгрузки 1С, иначе первый.
  const sheet =
    workbook.getWorksheet("TDSheet") ?? workbook.worksheets[0]
  if (!sheet) throw new Error("В файле отчёта нет ни одного листа")

  const matrix = sheetToMatrix(sheet)

  if (columnMapping && Object.keys(columnMapping).length > 0) {
    let headerRow = findHeaderRow(matrix, columnMapping)
    if (headerRow === null) headerRow = 0
    const dataRows = matrix.slice(headerRow + 1)

    const width = matrix[0]?.length ?? 0
    const picked: Array<{ canonical: string; index: number }> = []
    for (const [field, canonical] of Object.entries(CANONICAL_FROM_MAPPING)) {
      const letter = columnMapping[field]
      if (!letter) continue
      const index = columnLetterToIndex(letter)
      if (index === null || index >= width) {
        throw new Error(
          `Столбец ${letter} (${canonical}) вне диапазона файла (всего столбцов: ${width})`
        )
      }
      picked.push({ canonical, index })
    }

    const rows: StatementRow[] = []
    for (const raw of dataRows) {
      const row: StatementRow = {}
      let allEmpty = true
      for (const { canonical, index } of picked) {
        const value = raw[index]
        if (cellStr(value) !== "") allEmpty = false
        row[canonical] = value
      }
      if (allEmpty) continue
      row["Количество"] = coerceNumeric(row["Количество"])
      row["Сумма, руб."] = coerceNumeric(row["Сумма, руб."])
      rows.push(row)
    }
    return { rows }
  }

  // Без маппинга: заголовок — первая строка, при нехватке колонок ищем его.
  const buildRows = (headerIndex: number): { rows: StatementRow[]; missing: string[] } => {
    const header = matrix[headerIndex] ?? []
    const columns = new Map<number, string>()
    header.forEach((raw, index) => {
      const canonical = normalizeColumnName(raw)
      if (canonical) columns.set(index, canonical)
    })
    const present = new Set(columns.values())
    const missing = REQUIRED_STATEMENT_COLUMNS.filter((c) => !present.has(c))

    const rows: StatementRow[] = []
    for (const raw of matrix.slice(headerIndex + 1)) {
      const row: StatementRow = {}
      let allEmpty = true
      for (const [index, canonical] of columns) {
        const value = raw[index]
        if (cellStr(value) !== "") allEmpty = false
        row[canonical] = value
      }
      if (allEmpty) continue
      row["Количество"] = coerceNumeric(row["Количество"])
      row["Сумма, руб."] = coerceNumeric(row["Сумма, руб."])
      rows.push(row)
    }
    return { rows, missing }
  }

  let attempt = buildRows(0)
  if (attempt.missing.length > 0) {
    const headerRow = findHeaderRow(matrix)
    if (headerRow !== null) attempt = buildRows(headerRow)
  }
  if (attempt.missing.length > 0) {
    const header = matrix[0] ?? []
    const found = header.map((h) => cellStr(h)).filter(Boolean)
    throw new Error(
      `В файле отчёта не найдены колонки: ${attempt.missing.join(", ")}. Есть колонки: ${found.join(", ")}`
    )
  }
  return { rows: attempt.rows }
}
