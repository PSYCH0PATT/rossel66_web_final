import path from "path"
import { upsertParserRunStatus, type ParserStatusPlatform } from "@/lib/parser-status"

/** After Bandlink Python run, mirror parser_status from ephemeral SQLite into Postgres. */
export async function syncBandlinkParserStatusFromSqlite(): Promise<void> {
  try {
    const sqlite3 = require("sqlite3").verbose()
    const dbPath = path.join(process.cwd(), "bandlink_playlists.db")
    const row = await new Promise<{
      status?: string
      last_run?: string
      needs_new_cookies?: number
      failed_attempts?: number
      last_error?: string
    } | undefined>((resolve, reject) => {
      const db = new sqlite3.Database(dbPath)
      db.get(
        "SELECT status, last_run, needs_new_cookies, failed_attempts, last_error FROM parser_status WHERE id = 1",
        (err: Error | null, r: typeof resolve extends (v: infer V) => void ? V : never) => {
          db.close()
          if (err) reject(err)
          else resolve(r)
        }
      )
    })
    if (!row) return
    await upsertParserRunStatus("bandlink" as ParserStatusPlatform, {
      status: row.status ?? "idle",
      lastRun: row.last_run ? new Date(row.last_run) : null,
      needsNewCookies: row.needs_new_cookies === 1,
      failedAttempts: row.failed_attempts ?? 0,
      lastError: row.last_error ?? null,
    })
  } catch {
    /* SQLite may be missing on fresh deploy */
  }
}
