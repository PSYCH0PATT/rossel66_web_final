/**
 * Sync Prisma schema to TEST_DATABASE_URL / docker-compose.test.yml.
 *
 * Fresh test DBs cannot rely on `migrate deploy` (repo history has gaps).
 * We wipe the local public schema via SQL, then `db push` (no --force-reset).
 *
 * Usage: pnpm test:db:migrate
 */
import { execSync } from "child_process"
import { Client } from "pg"
import {
  loadTestEnvFiles,
  requireTestDatabaseUrl,
} from "../tests/support/env"

async function main() {
  loadTestEnvFiles()
  const url = requireTestDatabaseUrl()
  console.log(
    `Resetting + pushing schema to ${url.replace(/:[^:@/]+@/, ":***@")}`
  )

  const client = new Client({ connectionString: url })
  await client.connect()
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
    GRANT ALL ON SCHEMA public TO CURRENT_USER;
  `)
  await client.end()

  execSync("npx prisma db push --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
