import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

export function loadTestEnvFiles() {
  for (const name of [".env.test.local", ".env.e2e.local", ".env.local", ".env"]) {
    const filePath = resolve(process.cwd(), name)
    if (!existsSync(filePath)) continue
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const eq = t.indexOf("=")
      if (eq <= 0) continue
      const key = t.slice(0, eq).trim()
      let value = t.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

/** Default matches docker-compose.test.yml — never fall back to .env DATABASE_URL. */
export const DEFAULT_TEST_DATABASE_URL =
  "postgresql://rossel:rossel@127.0.0.1:54329/rossel_test"

export function requireTestDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL
  if (/supabase\.com|pooler\.|neon\.tech|amazonaws\.com/i.test(url)) {
    throw new Error(
      `Refusing test migrate against remote DB. Set TEST_DATABASE_URL to local docker (${DEFAULT_TEST_DATABASE_URL})`
    )
  }
  process.env.TEST_DATABASE_URL = url
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  return url
}
