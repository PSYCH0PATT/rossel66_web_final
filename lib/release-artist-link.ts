/**
 * Связь релиза с артистом на админской карточке.
 *
 * F-02: селект «Артист» показывал пустоту при реально привязанном артисте —
 * список опций приходил из постраничного /api/artists (20 записей, без AKA), и
 * текущий артист в него попросту не попадал. Radix Select без совпадающей опции
 * рисует плейсхолдер, из-за чего связь выглядела отсутствующей, а «Сохранить»
 * мог её потерять. Лечится с двух сторон: селект всегда знает про текущую связь
 * (buildReleaseArtistSelect), а API не даёт затереть её пустым значением
 * (stripUnchangedArtistId).
 */

export type ReleaseArtistOption = { id: string; name: string }

export type ReleaseArtistSelect = {
  /** Значение селекта: id текущего артиста либо пусто. */
  value: string
  /** Опции, в которых текущий артист присутствует гарантированно. */
  options: ReleaseArtistOption[]
}

/**
 * Опции и значение селекта «Артист». Если привязанного артиста нет в загруженном
 * списке (другая страница выдачи, привязанный профиль), он добавляется отдельной
 * опцией — селект показывает связь, а не пустоту.
 */
export function buildReleaseArtistSelect(input: {
  artistId?: string | null
  artistName?: string | null
  artists: Array<{ id: string; name?: string | null }>
}): ReleaseArtistSelect {
  const artistId = (input.artistId ?? "").trim()
  const options: ReleaseArtistOption[] = input.artists.map((artist) => ({
    id: artist.id,
    name: artist.name ?? artist.id,
  }))

  if (artistId.length === 0) {
    return { value: "", options }
  }

  if (!options.some((option) => option.id === artistId)) {
    const artistName = (input.artistName ?? "").trim()
    options.unshift({ id: artistId, name: artistName.length > 0 ? artistName : artistId })
  }

  return { value: artistId, options }
}

/**
 * Убирает из тела запроса пустой artistId. Пустое значение означает «поле не
 * меняли» (селект ещё не инициализирован), и превращать его в разрыв связи
 * нельзя: updateRelease пишет `artistId || null`, то есть молча обнуляет.
 */
export function stripUnchangedArtistId<T>(body: T): T {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return body

  const source = body as Record<string, unknown>
  if (!("artistId" in source)) return body

  const artistId = source.artistId
  const isBlank =
    artistId === null ||
    artistId === undefined ||
    (typeof artistId === "string" && artistId.trim().length === 0)
  if (!isBlank) return body

  const { artistId: _dropped, ...rest } = source
  return rest as T
}
