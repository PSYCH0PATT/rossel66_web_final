/**
 * Чистка тестовых учёток из базы — вторая половина F-37 (первая, фильтр списка,
 * живёт в lib/test-accounts.ts).
 *
 * Признак тестовой учётки берётся из того же правила, что и фильтр списка, —
 * чтобы «спрятано на экране» и «удалено из базы» не разъезжались.
 *
 * По умолчанию только показывает, что нашёл. Удаляет — с --apply, и только
 * учётки без релизов, отчётов и связанных профилей: всё остальное разбирается
 * руками, автоматике тут доверять нечему.
 *
 *   npx tsx scripts/cleanup-test-accounts.ts
 *   npx tsx scripts/cleanup-test-accounts.ts --apply
 */
import { prisma } from "../lib/prisma"
import { isTestAccount } from "../lib/test-accounts"

const apply = process.argv.includes("--apply")

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  })

  const candidates = users.filter((u) => isTestAccount(u))
  if (candidates.length === 0) {
    console.log("Тестовых учёток не найдено.")
    return
  }

  console.log(`Найдено тестовых учёток: ${candidates.length}${apply ? "" : " (режим показа, ничего не удаляю)"}`)

  for (const user of candidates) {
    const [releases, reports, linked] = await Promise.all([
      prisma.release.count({ where: { artistId: user.id } }),
      prisma.report.count({ where: { artistId: user.id } }),
      prisma.user.count({ where: { mainArtistId: user.id } }),
    ])

    const load = `релизов ${releases}, отчётов ${reports}, привязанных профилей ${linked}`
    const clean = releases === 0 && reports === 0 && linked === 0

    if (!clean) {
      console.log(`  ⏭  ${user.username} (${user.role}) — ${load}: разбирайте руками`)
      continue
    }

    if (!apply) {
      console.log(`  •  ${user.username} (${user.role}) — ${load}: будет удалена`)
      continue
    }

    await prisma.activity.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
    console.log(`  ✔  ${user.username} удалена`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
