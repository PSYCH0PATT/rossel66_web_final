/**
 * F9: корректный заголовок Content-Disposition для файлов с кириллицей.
 *
 * `filename="${encodeURIComponent(name)}"` заставляет браузер сохранять файл
 * буквально как «%D0%98%D0%BC%D1%8F.xlsx». По RFC 6266 нужно отдавать оба
 * параметра: ASCII-фолбэк в `filename` и UTF-8 версию в `filename*`.
 */

/** Транслитерация кириллицы для ASCII-фолбэка (его видят только старые клиенты). */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
}

function toAsciiFallback(fileName: string): string {
  let out = ""
  for (const char of fileName) {
    const lower = char.toLowerCase()
    const mapped = TRANSLIT[lower]
    if (mapped !== undefined) {
      out += char === lower ? mapped : mapped.toUpperCase()
      continue
    }
    // Кавычки и служебные символы в заголовке недопустимы
    out += /[\x20-\x7e]/.test(char) && !/["\\]/.test(char) ? char : "_"
  }
  const trimmed = out.trim()
  return trimmed === "" || trimmed === "." ? "file" : trimmed
}

/**
 * Возвращает значение заголовка Content-Disposition для скачивания.
 * Имя сохраняется как есть в UTF-8 (`filename*`), с ASCII-фолбэком.
 */
export function attachmentContentDisposition(fileName: string): string {
  const safe = (fileName || "file").replace(/[/\\]/g, "_")
  const ascii = toAsciiFallback(safe)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

/**
 * F9: уникальное имя внутри архива. JSZip при повторном `zip.file(name, …)`
 * молча заменяет предыдущую запись, поэтому у артистов-тёзок (или отчётов с
 * одинаковым именем файла) в архив попадал только последний.
 */
export function uniqueArchiveName(fileName: string, used: Set<string>): string {
  const safe = (fileName || "file").replace(/[/\\]/g, "_")
  const key = safe.toLowerCase()
  if (!used.has(key)) {
    used.add(key)
    return safe
  }

  const dot = safe.lastIndexOf(".")
  const base = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ""

  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`
    const candidateKey = candidate.toLowerCase()
    if (!used.has(candidateKey)) {
      used.add(candidateKey)
      return candidate
    }
  }
}
