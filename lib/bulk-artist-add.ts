/**
 * Массовое добавление артистов: план создания и дедупликация.
 *
 * F-01: экран /dashboard/admin/artists/bulk-add открывался с зашитым списком из
 * 22 имён, половина которых уже была в базе, — один клик «Добавить всех» плодил
 * дубли. Отсюда две вещи разом: дефолт списка пуст (DEFAULT_BULK_ARTIST_NAMES) и
 * дедупликация, которая живёт не только в форме, но и на сервере
 * (duplicateArtistReason в POST /api/artists).
 */

/** Дефолт списка на экране массового добавления — пусто. См. F-01. */
export const DEFAULT_BULK_ARTIST_NAMES: readonly string[] = []

export type ExistingArtist = { username?: string | null; name?: string | null }

export type BulkArtistCandidate = { name: string; username: string }

export type BulkArtistPlan = {
  /** Кого реально создавать. */
  toCreate: BulkArtistCandidate[]
  /** Имена, отброшенные как дубли — из них собирается отчёт «пропущено как дубль: N». */
  skippedDuplicates: string[]
}

/** Логин из имени артиста: латиница и цифры в нижнем регистре, остальное отбрасывается. */
export function artistNameToUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "")
}

/** Ключ сравнения имён: регистр и краевые пробелы не считаются. */
function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

export type DuplicateArtistReason = "username" | "name" | null

/**
 * Совпадает ли кандидат с уже существующим артистом. Логин сравнивается без
 * учёта регистра и только когда он непустой: у кириллических имён логин
 * вырождается в пустую строку, и такие имена дублями друг друга не являются.
 */
export function duplicateArtistReason(
  candidate: { username?: string | null; name?: string | null },
  existing: ExistingArtist[]
): DuplicateArtistReason {
  const username = (candidate.username ?? "").trim().toLowerCase()
  const name = nameKey(candidate.name ?? "")

  for (const other of existing) {
    const otherUsername = (other.username ?? "").trim().toLowerCase()
    if (username.length > 0 && otherUsername.length > 0 && otherUsername === username) {
      return "username"
    }
  }
  for (const other of existing) {
    if (name.length > 0 && nameKey(other.name ?? "") === name) {
      return "name"
    }
  }
  return null
}

/**
 * Раскладывает список имён на «создать» и «пропустить как дубль». Дубли ищутся и
 * среди существующих артистов, и внутри самого списка.
 */
export function planBulkArtistAdd(names: string[], existing: ExistingArtist[]): BulkArtistPlan {
  const seen: ExistingArtist[] = [...existing]
  const toCreate: BulkArtistCandidate[] = []
  const skippedDuplicates: string[] = []

  for (const raw of names) {
    const name = raw.trim()
    if (name.length === 0) continue

    const username = artistNameToUsername(name)
    if (duplicateArtistReason({ username, name }, seen) !== null) {
      skippedDuplicates.push(name)
      continue
    }

    toCreate.push({ name, username })
    seen.push({ username, name })
  }

  return { toCreate, skippedDuplicates }
}
