/**
 * Поднимает схему на TEST_DATABASE_URL / docker-compose.test.yml с нуля.
 *
 * Раньше здесь был `db push`, потому что в истории миграций были дыры. Дыры
 * закрыты (baseline для StreamAnalytics, роли PostgREST), поэтому теперь идёт
 * честный `migrate deploy`: каждый прогон тестов заодно проверяет, что цепочка
 * миграций применяется на пустую базу. Именно этот класс расхождений между
 * schema.prisma и реальной БД ловился раньше вручную.
 *
 * Если deploy упал — чинить недостающей миграцией, а не возвратом к db push:
 * db push молча приводит базу к схеме и скрывает ровно ту дыру, которую надо
 * увидеть до того, как она доедет до прода.
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
    `Применяю миграции с нуля на ${url.replace(/:[^:@/]+@/, ":***@")}`
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

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
