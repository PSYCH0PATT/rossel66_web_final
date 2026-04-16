/**
 * Дробит поле «исполнитель(и)» из парсеров на отдельные имена для автосоздания профилей.
 * Учитывает: запятая, & , feat / ft / featuring, « x », « и / and ».
 * Unicode-запятая (U+FF0C) нормализуется в ASCII.
 */
const COLLAB_SEP =
  /\s*(?:,|&|\+|\s+(?:feat\.?|ft\.?|featuring)\s+|\s+x\s+|\s+(?:и|and)\s+)\s*/i

export function splitCollaboratingArtistDisplayNames(raw: string): string[] {
  const s = raw.replace(/\uFF0C/g, ",").trim()
  if (!s) return []

  const parts = s
    .split(COLLAB_SEP)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}
