/**
 * Кто указан у релиза одной человекочитаемой строкой: «rompy, Лоло» (F-91).
 *
 * Основным берётся артист самого релиза (`artistName` из API), а не владелец
 * кабинета: в объединённом кабинете группы связанных профилей (AKA) релизы
 * принадлежат разным профилям, и подпись именем главного была бы неверной.
 * Приглашённые собираются и с релиза, и с треков — у Zvonko фиты приезжают
 * на уровне трека.
 *
 * Модуль общий: список релизов колонку «Артисты» потерял (вердикт 3.3 —
 * в собственном кабинете она во всех строках повторяла одно имя), а карта
 * релиза этой строкой заменила псевдокнопочный чип артиста (вердикт 3.4).
 */

type NamedTrack = { featuredArtistNames?: unknown }

export type ReleaseArtistsSource = {
  artistName?: unknown
  featuredArtistNames?: unknown
  tracks?: unknown
}

function pushNames(target: string[], value: unknown): void {
  if (!Array.isArray(value)) return
  for (const name of value) {
    const text = typeof name === "string" ? name.trim() : ""
    if (text && !target.includes(text)) target.push(text)
  }
}

export function releaseArtistsLine(
  release: ReleaseArtistsSource | null | undefined,
  fallbackName: string
): string {
  const mainRaw = typeof release?.artistName === "string" ? release.artistName.trim() : ""
  const mainName = mainRaw || fallbackName

  const featuredNames: string[] = []
  pushNames(featuredNames, release?.featuredArtistNames)
  if (Array.isArray(release?.tracks)) {
    for (const track of release.tracks as NamedTrack[]) {
      pushNames(featuredNames, track?.featuredArtistNames)
    }
  }

  const featured = featuredNames.filter((name) => name !== mainName)
  return featured.length ? `${mainName}, ${featured.join(", ")}` : mainName
}
