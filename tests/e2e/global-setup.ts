/**
 * Подготовка локального e2e-прогона.
 *
 * Делает две вещи, обе — защита от прогона «не там»:
 *  1. Проверяет, что база сидирована (маркер e2e-guard). Иначе тесты молча
 *     работали бы по чужой базе и упали бы непонятными ошибками — или, хуже,
 *     что-то в ней поменяли.
 *  2. Поднимает стаб Supabase Storage на фиксированном порту. Без него роуты
 *     отчётов уйдут в настоящий Supabase: lib/supabase.ts при пустых переменных
 *     подставляет захардкоженный прод-URL.
 */
import { execFileSync } from "child_process"
import { Client } from "pg"
import { startMockSupabaseStorage, type MockStorage } from "../support/mock-supabase-storage"

let storage: MockStorage | undefined

/**
 * Сид перед каждым прогоном: иначе сюиты зависят от порядка запуска и от того,
 * что осталось от прошлого раза. Сквозной тест генератора, например, добавляет
 * артисту отчёт — и проверка баланса в другом файле начинает видеть другую сумму.
 */
function reseed() {
  try {
    execFileSync("npx", ["tsx", "scripts/seed-e2e.ts"], { stdio: "pipe" })
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer }
    throw new Error(
      "Не удалось засеять базу. Поднята ли она?\n" +
        "  docker compose -f docker-compose.test.yml up -d && pnpm test:db:migrate\n\n" +
        (err.stderr?.toString() || err.stdout?.toString() || String(error))
    )
  }
}

async function assertSeeded(url: string) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM "User" WHERE username = 'e2e-guard'`
    )
    if (rows[0]?.c !== 1) {
      throw new Error("Сид отработал, но маркера e2e-guard в базе нет — что-то не так с сидом.")
    }
  } finally {
    await client.end()
  }
}

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? ""
  if (/supabase\.com|pooler\.|neon\.tech|amazonaws\.com/i.test(url)) {
    throw new Error(
      `e2e отказывается работать с удалённой базой (${url.replace(/:[^:@/]+@/, ":***@")}).\n` +
        "Ожидается локальный контейнер из docker-compose.test.yml."
    )
  }

  reseed()
  await assertSeeded(url)

  const port = Number(process.env.E2E_STORAGE_PORT || 54330)
  storage = await startMockSupabaseStorage(port)
  console.log(`[e2e] стаб Supabase Storage на ${storage.url}`)

  return async () => {
    await storage?.close()
  }
}
