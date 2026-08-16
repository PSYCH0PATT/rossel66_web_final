/**
 * Сопоставление строк выписки с артистами лейбла.
 *
 * Порт логики из `lib/python-report-processor.py` — поведение воспроизведено
 * дословно, включая неочевидные места (отмечены в комментариях).
 */

/** Строка из users.json — выгрузка `lib/export-data-for-python.ts`. */
export type ExportedArtist = {
  id?: string
  role?: string
  name?: string
  username?: string
  fio?: string | null
  fioShort?: string | null
  contract?: string | null
  percentage?: number | string | null
  mainArtistId?: string | null
}

/** Данные артиста для отчёта: те же пять полей, что были списком в питоне. */
export type ArtistReportData = {
  fio: string
  fioShort: string
  contract: string
  /** Строкой — как `str(percentage)` в питоне; разбор в `parsePercentage`. */
  percentage: string
  id: string
}

/** (canonical, [алиасы]) — по этому списку сопоставляются строки выписки. */
export type MatchEntry = { canonical: string; aliases: string[] }

export type IncompleteArtist = { name: string; missingFields: string[] }

export type ArtistsIndex = {
  /** Артисты с полными реквизитами: только им строится отчёт. */
  artistsData: Map<string, ArtistReportData>
  matchList: MatchEntry[]
  skippedIncomplete: IncompleteArtist[]
  /** Имя любого профиля группы → canonical главного. */
  aliasToCanonical: Map<string, string>
  /** Все имена и ники из выгрузки — для флага isRegistered. */
  registeredNames: Set<string>
  logs: string[]
}

const FIELD_LABELS: Record<string, string> = {
  fio: "ФИО",
  contract: "Номер договора",
  percentage: "Процент",
}

/** Пустым считается null/undefined, пустая строка и прочерк. */
function isEmptyReportValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const s = String(value).trim()
  return s === "" || s === "-"
}

/**
 * Каких реквизитов не хватает для отчёта.
 *
 * ВНИМАНИЕ: сознательно НЕ переиспользуется `getArtistReportMissingFields`
 * из lib/artist-report-requirements.ts — там `percentage <= 0` считается
 * отсутствующим, а здесь ноль допустим (так вёл себя питон, и так же записано
 * в openspec/specs/report-processing/spec.md).
 */
export function missingReportFields(user: ExportedArtist): string[] {
  const missing: string[] = []
  if (isEmptyReportValue(user.fio)) missing.push("fio")
  if (isEmptyReportValue(user.contract)) missing.push("contract")
  if (user.percentage === null || user.percentage === undefined || user.percentage === "") {
    missing.push("percentage")
  }
  return missing
}

/**
 * Строит индекс артистов из выгрузки.
 *
 * Связанные профили (AKA) не становятся отдельными артистами: их имена входят
 * псевдонимами в группу главного, поэтому строки выписки, подписанные любым из
 * имён, собираются в один отчёт.
 */
export function buildArtistsIndex(usersData: ExportedArtist[]): ArtistsIndex {
  const logs: string[] = []
  const artists = usersData.filter(
    (u) => u.role === "artist" && (u.name || u.username)
  )

  const byId = new Map<string, ExportedArtist>()
  for (const u of artists) if (u.id) byId.set(u.id, u)

  // Привязка учитывается, только если главный есть в этой же выгрузке.
  // Иначе (профиль удалён, ссылка повисла) артист работает сам по себе.
  const children = new Map<string, ExportedArtist[]>()
  const linkedIds = new Set<string>()
  for (const user of artists) {
    const mainId = user.mainArtistId
    if (mainId && byId.has(mainId) && mainId !== user.id) {
      const list = children.get(mainId) ?? []
      list.push(user)
      children.set(mainId, list)
      if (user.id) linkedIds.add(user.id)
    }
  }

  const artistsData = new Map<string, ArtistReportData>()
  const matchList: MatchEntry[] = []
  const aliasToCanonical = new Map<string, string>()
  const skippedIncomplete: IncompleteArtist[] = []

  for (const user of artists) {
    if (user.id && linkedIds.has(user.id)) continue // войдёт псевдонимом в группу главного

    const canonical = (user.name || user.username) as string
    const group = [user, ...(children.get(user.id ?? "") ?? [])]

    const aliases: string[] = []
    for (const member of group) {
      for (const alias of [member.name, member.username]) {
        if (alias && !aliases.includes(alias)) aliases.push(alias)
      }
    }
    for (const alias of aliases) aliasToCanonical.set(alias, canonical)

    if (group.length > 1) {
      const extra = group.slice(1).map((m) => m.name || m.username).join(", ")
      logs.push(`🔗 ${canonical}: в отчёт войдут привязанные профили — ${extra}`)
    }

    const missing = missingReportFields(user)
    if (missing.length > 0) {
      const labels = missing.map((f) => FIELD_LABELS[f] ?? f)
      logs.push(
        `⚠️  Пропущен артист ${canonical}: не хватает данных для отчёта (${labels.join(", ")})`
      )
      skippedIncomplete.push({ name: canonical, missingFields: missing })
      // Псевдонимы группы остаются в match_list: без них строки привязанных
      // профилей молча утекли бы в «нераспознанные».
      matchList.push({ canonical, aliases })
      continue
    }

    artistsData.set(canonical, {
      fio: user.fio || user.name || "",
      fioShort: user.fioShort || user.fio || user.name || "",
      contract: user.contract || "",
      percentage: String(user.percentage),
      id: user.id ?? "",
    })
    matchList.push({ canonical, aliases })
  }

  // isRegistered в питоне считался по отдельному проходу: все name и username.
  const registeredNames = new Set<string>()
  for (const user of usersData) {
    if (user.username) registeredNames.add(user.username)
    if (user.name) registeredNames.add(user.name)
  }

  logs.push(`✅ Загружено ${artistsData.size} артистов`)
  return { artistsData, matchList, skippedIncomplete, aliasToCanonical, registeredNames, logs }
}

/** Кэш регулярок: на большой выписке они строятся десятки тысяч раз. */
const aliasPatternCache = new Map<string, RegExp>()

function aliasPattern(alias: string): RegExp {
  const cached = aliasPatternCache.get(alias)
  if (cached) return cached
  // G3: имя матчится только как ЦЕЛЫЙ токен, иначе «Rem» ловит «Rema»,
  // а «Ян» — «Боян», и артист получает чужие роялти.
  //
  // В питоне это \w с Unicode-семантикой. В JS \w — только латиница, поэтому
  // границы заданы явно через свойства Unicode, иначе кириллические имена
  // начали бы цеплять чужие строки.
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,
    "iu"
  )
  aliasPatternCache.set(alias, pattern)
  return pattern
}

/**
 * Артисты, найденные в строке исполнителя.
 *
 * Разделители (feat., &, запятая) специально НЕ разбираются — питон искал
 * каждый алиас как отдельное слово в строке. Порядок результата — порядок
 * артистов в выгрузке, каждый canonical добавляется не более одного раза.
 */
export function extractArtistsFromTrack(
  artistStr: unknown,
  matchList: MatchEntry[]
): string[] {
  const haystack = typeof artistStr === "string" ? artistStr : String(artistStr)
  const found: string[] = []
  for (const { canonical, aliases } of matchList) {
    for (const alias of aliases) {
      if (alias && aliasPattern(alias).test(haystack)) {
        found.push(canonical)
        break
      }
    }
  }
  return found
}
