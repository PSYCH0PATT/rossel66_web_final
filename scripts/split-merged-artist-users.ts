/**
 * Разделяет «склеенные» профили артистов (имя с запятой, &, feat и т.д.)
 * по правилам splitCollaboratingArtistDisplayNames.
 *
 * Запуск:
 *   npx tsx scripts/split-merged-artist-users.ts --dry-run
 *   npx tsx scripts/split-merged-artist-users.ts
 */

import "dotenv/config"
import { Prisma } from "@prisma/client"
import { prisma } from "../lib/prisma"
import { splitCollaboratingArtistDisplayNames } from "../lib/split-artist-names"
import { addUser, findArtistByName, getUserByUsername } from "../lib/storage"
import { nicknameToUsername } from "../lib/utils"

const DRY = process.argv.includes("--dry-run")

async function uniqueUsername(base: string): Promise<string> {
  let u = base || "artist"
  let n = 0
  while (await getUserByUsername(u)) {
    n += 1
    u = `${base}_${n}_${Date.now().toString(36)}`
  }
  return u
}

function uniq(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function mergeFeaturedForPrimary(
  existing: string[] | null | undefined,
  wrongId: string,
  secondaryIds: string[],
  primaryId: string
): string[] {
  const base = [...(existing ?? [])].filter((id) => id && id !== wrongId)
  const set = new Set(base)
  for (const id of secondaryIds) {
    if (id && id !== primaryId) set.add(id)
  }
  return [...set]
}

/**
 * id в порядке parts: существующие артисты подхватываются; первый «без пары»
 * переименовывает wrongId; остальные сегменты — новые addUser.
 */
async function resolveOrderedUserIds(
  parts: string[],
  wrongId: string
): Promise<{ orderedIds: string[]; repurposedWrong: boolean }> {
  const orderedIds: string[] = []
  let repurposedWrong = false

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const found = await findArtistByName(trimmed)
    if (found && found.id !== wrongId) {
      orderedIds.push(found.id)
      continue
    }

    if (!repurposedWrong) {
      const username = await uniqueUsername(nicknameToUsername(trimmed))
      await prisma.user.update({
        where: { id: wrongId },
        data: { name: trimmed, username },
      })
      orderedIds.push(wrongId)
      repurposedWrong = true
      console.log(`    ✅ Профиль ${wrongId} → «${trimmed}» (@${username})`)
      continue
    }

    const username = await uniqueUsername(nicknameToUsername(trimmed))
    const created = await addUser({
      username,
      name: trimmed,
      email: "",
      role: "artist",
      password: Math.random().toString(36).slice(-12),
      verified: false,
    })
    orderedIds.push(created.id)
    console.log(`    ✅ Создан «${trimmed}» (${created.id})`)
  }

  return { orderedIds, repurposedWrong }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Нет DATABASE_URL (.env / .env.local)")
    process.exit(1)
  }

  console.log(DRY ? "🔎 --dry-run (без записи в БД)\n" : "⚙️  Запись в БД\n")

  const artistRows = await prisma.user.findMany({
    where: { role: "artist" },
    orderBy: { createdAt: "asc" },
  })

  let mergedCandidates = 0
  let applied = 0

  for (const row of artistRows) {
    const wrongId = row.id
    const mergedName = row.name?.trim() || ""
    if (!mergedName) continue

    const parts = splitCollaboratingArtistDisplayNames(mergedName)
    if (parts.length < 2) continue

    mergedCandidates++
    console.log(`\n── «${mergedName}» (${wrongId}) → ${JSON.stringify(parts)}`)

    if (DRY) {
      for (const p of parts) {
        const f = await findArtistByName(p)
        console.log(`    часть «${p}»: ${f ? `есть id=${f.id}` : "нет пользователя"}`)
      }
      const rc = await prisma.release.count({
        where: { OR: [{ artistId: wrongId }, { featuredArtistIds: { has: wrongId } }] },
      })
      const pc = await prisma.playlist.count({ where: { artistId: wrongId } })
      const rpc = await prisma.report.count({ where: { artistId: wrongId } })
      const sc = await prisma.streamAnalytics.count({ where: { artistId: wrongId } })
      const ac = await prisma.activity.count({ where: { userId: wrongId } })
      console.log(
        `    затронет: релизы ${rc}, плейлисты ${pc}, отчёты ${rpc}, стримы ${sc}, активность ${ac}`
      )
      continue
    }

    const { orderedIds, repurposedWrong } = await resolveOrderedUserIds(parts, wrongId)
    if (orderedIds.length < 2) {
      console.log("    ⚠️  Меньше двух id — пропуск")
      continue
    }

    const primaryId = orderedIds[0]
    const secondaryIds = orderedIds.slice(1)
    const displayName = mergedName

    const releaseRows = await prisma.release.findMany({
      where: {
        OR: [{ artistId: wrongId }, { featuredArtistIds: { has: wrongId } }],
      },
    })

    for (const rel of releaseRows) {
      const meta = (rel.metadata as Record<string, unknown> | null) || {}
      const nextMeta = { ...meta, artistName: displayName }

      let nextArtistId = rel.artistId
      let nextFeatured = [...(rel.featuredArtistIds ?? [])]

      if (rel.artistId === wrongId) {
        nextArtistId = primaryId
        nextFeatured = mergeFeaturedForPrimary(nextFeatured, wrongId, secondaryIds, primaryId)
      } else {
        nextFeatured = (rel.featuredArtistIds ?? []).filter((id) => id !== wrongId)
        for (const id of orderedIds) {
          if (id !== rel.artistId) nextFeatured.push(id)
        }
        nextFeatured = uniq(nextFeatured)
      }

      await prisma.release.update({
        where: { id: rel.id },
        data: {
          artistId: nextArtistId,
          featuredArtistIds: uniq(nextFeatured),
          metadata: nextMeta as Prisma.InputJsonValue,
        },
      })
      console.log(`    📀 Релиз ${rel.id}: artistId=${nextArtistId}`)
    }

    const pl = await prisma.playlist.updateMany({
      where: { artistId: wrongId },
      data: { artistId: primaryId },
    })
    if (pl.count) console.log(`    📋 Плейлисты artistId: ${pl.count}`)

    const repc = await prisma.report.updateMany({
      where: { artistId: wrongId },
      data: { artistId: primaryId },
    })
    if (repc.count) console.log(`    📄 Отчёты artistId: ${repc.count}`)

    const st = await prisma.streamAnalytics.updateMany({
      where: { artistId: wrongId },
      data: { artistId: primaryId },
    })
    if (st.count) console.log(`    📈 StreamAnalytics: ${st.count}`)

    const act = await prisma.activity.updateMany({
      where: { userId: wrongId },
      data: { userId: primaryId },
    })
    if (act.count) console.log(`    🔔 Activity userId: ${act.count}`)

    if (!repurposedWrong) {
      const refR = await prisma.release.count({
        where: {
          OR: [{ artistId: wrongId }, { featuredArtistIds: { has: wrongId } }],
        },
      })
      const refP = await prisma.playlist.count({ where: { artistId: wrongId } })
      const refRep = await prisma.report.count({ where: { artistId: wrongId } })
      const refS = await prisma.streamAnalytics.count({ where: { artistId: wrongId } })
      const refA = await prisma.activity.count({ where: { userId: wrongId } })
      if (refR + refP + refRep + refS + refA === 0) {
        await prisma.user.delete({ where: { id: wrongId } })
        console.log(`    🗑️  Удалён неиспользуемый профиль ${wrongId}`)
      } else {
        console.log(
          `    ⚠️  Профиль ${wrongId} не удалён (ещё ссылки: r${refR} p${refP} rep${refRep} s${refS} a${refA})`
        )
      }
    }

    applied++
  }

  console.log("\n══════════════════════════════════════════")
  if (DRY) {
    console.log(`Кандидатов на разделение: ${mergedCandidates}`)
    console.log("Запустите без --dry-run для применения.")
  } else {
    console.log(`Кандидатов: ${mergedCandidates}, обработано: ${applied}`)
  }
  console.log("══════════════════════════════════════════\n")

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
