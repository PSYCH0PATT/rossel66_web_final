/** Парсит releaseDate в timestamp (ms). Поддерживает DD.MM.YYYY и YYYY-MM-DD. */
export function parseReleaseDateToTimestamp(dStr: string | null | undefined): number {
  if (!dStr || dStr === "--") return 0

  const trimmed = dStr.trim()
  if (!trimmed) return 0

  if (trimmed.includes(".")) {
    const parts = trimmed.split(".")
    if (parts.length === 3) {
      const [d, m, y] = parts
      const t = new Date(
        `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
      ).getTime()
      return Number.isNaN(t) ? 0 : t
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const t = new Date(trimmed.slice(0, 10)).getTime()
    return Number.isNaN(t) ? 0 : t
  }

  const t = new Date(trimmed).getTime()
  return Number.isNaN(t) ? 0 : t
}

/**
 * A1: канонический формат хранения даты релиза — "YYYY-MM-DD".
 *
 * Release.releaseDate — строка, и писатели приносили её в двух форматах:
 * парсеры Koala/Zvonko дают "DD.MM.YYYY", форма добавления — "YYYY-MM-DD".
 * Из-за этого строковые сравнения (`where: { releaseDate }`), строковая
 * сортировка и голый `new Date(releaseDate)` работали неверно — это корень
 * всех date-багов раздела A.
 *
 * Нормализуем на записи, в одном месте, чтобы никакой новый писатель не мог
 * снова занести «свой» формат. Непарсящееся значение возвращаем как есть —
 * молча терять введённое пользователем нельзя.
 */
export function normalizeReleaseDate(input: string | null | undefined): string {
  if (input == null) return ""
  const trimmed = String(input).trim()
  if (!trimmed || trimmed === "--") return ""

  const ts = parseReleaseDateToTimestamp(trimmed)
  if (!ts) return trimmed

  const d = new Date(ts)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Сортировка по убыванию даты релиза (новые сверху), при равенстве — по createdAt. */
export function compareReleasesByDateDesc(
  a: { releaseDate: string; createdAt: Date },
  b: { releaseDate: string; createdAt: Date }
): number {
  const timeA = parseReleaseDateToTimestamp(a.releaseDate)
  const timeB = parseReleaseDateToTimestamp(b.releaseDate)
  if (timeA !== timeB) return timeB - timeA
  return b.createdAt.getTime() - a.createdAt.getTime()
}
