// Временная read-only проверка: только логины и роли, колонка password не выбирается.
import { prisma } from "../lib/prisma"

async function main() {
  const users = await prisma.user.findMany({
    select: { username: true, role: true, name: true },
    orderBy: { username: "asc" },
  })
  console.log("пользователей в базе:", users.length)
  for (const u of users.slice(0, 12)) {
    console.log(`  ${(u.role ?? "?").padEnd(7)} ${u.username}  (${u.name ?? "—"})`)
  }
  if (users.length > 12) console.log(`  … и ещё ${users.length - 12}`)
  console.log("есть ли admin:", users.some((u) => u.username === "admin") ? "ДА" : "НЕТ")
  console.log("релизов:", await prisma.release.count(), "| отчётов:", await prisma.report.count())
  await prisma.$disconnect()
}

void main()
