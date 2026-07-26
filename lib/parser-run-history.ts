import { prisma } from "@/lib/prisma"

/**
 * История запусков парсеров (VK / Bandlink) в Postgres.
 *
 * Раньше это был SQLite (`parsing_history` в vk_playlists.db / bandlink_playlists.db):
 * - F-PARS-3: парсеры писали историю self-fetch'ем без cron-заголовка → 401 → успешные
 *   запуски VK вообще не попадали в историю (ошибка глоталась в catch);
 * - F-PARS-10: нативный `sqlite3` не всегда собирается → /api/parsers/history → 500;
 * - F-PARS-11: статус «running» оставался навсегда, если процесс убит или прошёл деплой.
 */

export type ParserType = "vk" | "bandlink"

/** Таблицы ещё нет — миграция не применена (deploy запускает prisma migrate deploy). */
export function isMissingParserRunTable(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  // P2021 — таблица не существует; 42P01 — то же от драйвера Postgres
  return code === "P2021" || code === "P2010" || code === "42P01"
}

/** Запуск, зависший в `running` дольше этого времени, считаем провалившимся. */
export const STALE_RUN_TIMEOUT_MINUTES = 30

/** Форма, которую ожидает UI (исторически snake_case из SQLite). */
export type ParserRunRow = {
  id: string
  parser_type: string
  artists: string
  playlists_found: number
  playlists_added: number
  errors: string | null
  status: string
  started_at: string
  completed_at: string | null
}

function normalizeArtists(artists: string[] | string): string {
  return Array.isArray(artists) ? artists.join(", ") : String(artists ?? "")
}

function normalizeErrors(errors: unknown): string | null {
  if (errors == null) return null
  if (typeof errors === "string") return errors.trim() === "" ? null : errors
  try {
    return JSON.stringify(errors)
  } catch {
    return String(errors)
  }
}

function toRow(run: {
  id: string
  parserType: string
  artists: string
  playlistsFound: number
  playlistsAdded: number
  errors: string | null
  status: string
  startedAt: Date
  completedAt: Date | null
}): ParserRunRow {
  return {
    id: run.id,
    parser_type: run.parserType,
    artists: run.artists,
    playlists_found: run.playlistsFound,
    playlists_added: run.playlistsAdded,
    errors: run.errors,
    status: run.status,
    started_at: run.startedAt.toISOString(),
    completed_at: run.completedAt ? run.completedAt.toISOString() : null,
  }
}

/**
 * Записывает завершённый (или упавший) запуск парсера.
 * Вызывать напрямую из роутов парсеров — без self-fetch.
 */
export async function recordParserRun(input: {
  parserType: string
  artists: string[] | string
  playlistsFound?: number
  playlistsAdded?: number
  errors?: unknown
  status?: string
}): Promise<ParserRunRow> {
  const status = input.status ?? "completed"
  const run = await prisma.parserRun.create({
    data: {
      parserType: input.parserType,
      artists: normalizeArtists(input.artists),
      playlistsFound: input.playlistsFound ?? 0,
      playlistsAdded: input.playlistsAdded ?? 0,
      errors: normalizeErrors(input.errors),
      status,
      completedAt: status === "running" ? null : new Date(),
    },
  })
  return toRow(run)
}

/**
 * F-PARS-11 (watchdog): помечает зависшие `running` запуски как `failed`.
 * Без этого UI вечно показывал «Выполняется» после убитого процесса или деплоя.
 * Возвращает количество закрытых запусков.
 */
export async function failStaleParserRuns(
  timeoutMinutes: number = STALE_RUN_TIMEOUT_MINUTES
): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60_000)
  const { count } = await prisma.parserRun.updateMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    data: {
      status: "failed",
      completedAt: new Date(),
      errors: `Запуск не завершился за ${timeoutMinutes} мин — помечен как проваленный (процесс убит или прошёл деплой)`,
    },
  })
  return count
}

/**
 * Список запусков для UI. `parserType: "all"` — оба парсера.
 * Перед выдачей закрывает зависшие запуски, чтобы UI не крутил «Выполняется» вечно.
 */
export async function listParserRuns(options?: {
  parserType?: string
  limit?: number
}): Promise<ParserRunRow[]> {
  const limit = Math.min(Math.max(1, options?.limit ?? 50), 200)
  const parserType = options?.parserType ?? "all"

  await failStaleParserRuns()

  const runs = await prisma.parserRun.findMany({
    where: parserType === "all" ? {} : { parserType },
    orderBy: { startedAt: "desc" },
    take: limit,
  })

  return runs.map(toRow)
}
