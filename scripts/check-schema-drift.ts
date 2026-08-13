/**
 * Сторож расхождения между schema.prisma и цепочкой миграций.
 *
 * Запускается после `pnpm test:db:migrate`, то есть по базе, собранной миграциями
 * с нуля. Спрашивает у Prisma: «какой SQL нужен, чтобы догнать базу до схемы?».
 * Любой ответ, кроме известного списка ниже, означает, что кто-то поменял
 * schema.prisma и забыл написать миграцию — ровно так в базе появились колонка
 * `User.verified` и таблица `ParserRun` без миграций, и это всплыло только
 * спустя месяцы.
 *
 * Известные и допустимые расхождения — три индекса, которые язык схемы Prisma
 * не умеет выражать (GIN и btree DESC). Они созданы сырым SQL в миграциях, живут
 * в базе и в схеме не отражаются, поэтому Prisma каждый раз предлагает их удалить.
 * Список закрытый: любой НОВЫЙ индекс здесь тоже упадёт, пока его сюда не внесут
 * осознанно.
 *
 * Usage: pnpm check:drift
 */
import { execFileSync } from "child_process"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../tests/support/env"

/** Индексы, которых нет и не может быть в schema.prisma. */
const ALLOWED_DROP_INDEXES = [
  "Release_featuredArtistIds_gin_idx",
  "Release_tracks_gin_idx",
  "Report_uploadedAt_desc_idx",
]

function main() {
  loadTestEnvFiles()
  const url = requireTestDatabaseUrl()

  const script = execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
    ],
    { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, encoding: "utf-8" }
  )

  const unexpected = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("--"))
    .filter((line) => {
      const dropped = line.match(/^DROP INDEX "([^"]+)";$/)
      return !(dropped && ALLOWED_DROP_INDEXES.includes(dropped[1]))
    })

  if (unexpected.length === 0) {
    console.log("✅ schema.prisma и миграции сходятся")
    return
  }

  console.error(
    "❌ schema.prisma разошлась с миграциями. Похоже, поле изменили в схеме,\n" +
      "   но миграцию не написали. Ниже — SQL, которого не хватает в migrations/:\n"
  )
  for (const line of unexpected) console.error("   " + line)
  console.error(
    "\n   Починка: добавить миграцию с этим SQL (идемпотентно, IF NOT EXISTS),\n" +
      "   а не подгонять базу через `prisma db push`."
  )
  process.exit(1)
}

main()
