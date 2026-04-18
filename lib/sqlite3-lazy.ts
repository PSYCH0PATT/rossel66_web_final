import type { Database } from 'sqlite3'

/** Нативный sqlite3 не импортировать на верхнем уровне — ломает `next build` без .node. */
export function loadSqlite3(): typeof import('sqlite3') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('sqlite3')
}

export function openSqlite(dbPath: string): Database {
  const sqlite3 = loadSqlite3()
  return new sqlite3.Database(dbPath)
}
