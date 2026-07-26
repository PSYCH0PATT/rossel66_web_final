/**
 * F-PARS-14: единый разбор CSV для парсеров плейлистов и flash-аналитики.
 *
 * Раньше это были две самописные копии с разным поведением:
 * - `sftp-playlist-parser.ts` просто переключал флаг на каждой кавычке и НЕ
 *   понимал экранированную `""` — поле вида `Best of ""Rock""` разъезжалось,
 *   сдвигая все последующие колонки строки;
 * - `flash-parser.ts` кавычки разбирал правильно, но не срезал BOM, поэтому у
 *   файла с BOM первое поле заголовка приходило с невидимым U+FEFF и поиск
 *   колонки по имени не срабатывал.
 *
 * Разделитель в обоих источниках — точка с запятой (;).
 */

export const CSV_DELIMITER = ";"

/** Разбирает строку CSV с учётом кавычек и экранированных `""`. */
export function parseCsvLine(line: string, delimiter: string = CSV_DELIMITER): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        // Экранированная кавычка внутри поля: "" -> "
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      fields.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }

  fields.push(current.trim())
  return fields
}

/** Срезает BOM, нормализует CRLF и отбрасывает пустые строки. */
export function splitCsvLines(content: string): string[] {
  const withoutBom =
    content.length > 0 && content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
  return withoutBom.split(/\r?\n/).filter((line) => line.trim().length > 0)
}
