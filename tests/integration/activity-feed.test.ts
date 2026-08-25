/**
 * Журнал событий против настоящего Postgres: дедуп пар (F-03), подпись актора
 * (F-03) и лента кабинета по группе профилей и metadata (F-04).
 *
 * Чистые правила покрыты в lib/activity-log.test.ts. Здесь проверяется то,
 * что живёт в SQL: JSON-фильтр `metadata.path` и склейка страницы.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *   pnpm test:db:migrate && pnpm seed:e2e
 *   pnpm test:integration
 */
import assert from "node:assert/strict"
import { before, describe, it } from "node:test"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../support/env"

loadTestEnvFiles()
const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rossel:rossel@127.0.0.1:54329/rossel_test"
process.env.DATABASE_URL = TEST_DB
process.env.DIRECT_URL = TEST_DB
process.env.BUILDIN_DUAL_WRITE = "false"
process.env.PYRUS_WRITE_DISABLED = "true"

const MAIN = "e2e-main-id"
const LINKED = "e2e-linked-id"
const SOLO = "e2e-solo-id"
const ADMIN = "e2e-admin-id"
const AT = new Date("2026-08-15T12:53:04.000Z")

let skipSuite = false

before(async () => {
  try {
    requireTestDatabaseUrl()
    const pg = await import("pg")
    const client = new pg.default.Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 3000,
    })
    await client.connect()
    const seeded = await client.query(
      `SELECT count(*)::int AS c FROM "User" WHERE username = 'e2e-guard'`
    )
    await client.end()
    if (seeded.rows[0]?.c !== 1) {
      throw new Error("база не сидирована — запустите pnpm seed:e2e")
    }
  } catch (err) {
    if (process.env.CI === "true" || process.env.CI === "1") throw err
    skipSuite = true
    console.warn("Пропускаю интеграционный сюит:", err)
  }
})

async function resetState() {
  const { prisma } = await import("@/lib/prisma")
  await prisma.activity.deleteMany({})
}

/** Пара строк, которой журнал задваивался до фикса. */
async function seedTwinReleaseEvent(artistId: string, artistName: string, releaseId: string) {
  const { prisma } = await import("@/lib/prisma")
  await prisma.activity.createMany({
    data: [
      {
        id: `act-artist-${releaseId}`,
        type: "release_added",
        userId: artistId,
        userRole: "artist",
        title: "Добавлен релиз",
        description: `Добавлен релиз "${releaseId}"`,
        metadata: { artistId, releaseId },
        createdAt: AT,
      },
      {
        id: `act-system-${releaseId}`,
        type: "release_added",
        userId: "system",
        userRole: "admin",
        title: "Добавлен релиз",
        description: `Добавлен релиз "${releaseId}" (артист: ${artistName})`,
        metadata: { artistId, artistName, releaseId },
        createdAt: AT,
      },
    ],
  })
}

describe("F-03: журнал админа", () => {
  it("пара «артисту + админу» об одном релизе показывается один раз", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    await seedTwinReleaseEvent(MAIN, "E2E Main", "rel-phantom")
    await seedTwinReleaseEvent(MAIN, "E2E Main", "rel-starlight")

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities, total } = await getActivitiesFiltered({}, 50, 0)

    assert.equal(activities.length, 2, "в журнале осталась пара дублей")
    assert.equal(total, 2, "счётчик журнала считает дубли за события")

    // Счётчик не должен прыгать при листании: на второй странице «всего»
    // обязано остаться тем же числом.
    const page2 = await getActivitiesFiltered({}, 1, 1)
    const page1 = await getActivitiesFiltered({}, 1, 0)
    assert.equal(page1.total, 2)
    assert.equal(page2.total, 2)
  })

  it("колонка «КТО» получает имя, а не сырой числовой id", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.create({
      data: {
        id: "act-who",
        type: "report_received",
        userId: MAIN,
        userRole: "artist",
        title: "Назначен отчёт",
        description: "Вам назначен отчёт по кварталу",
        metadata: { artistId: MAIN, reportId: "e2e-report-main-q1" },
        createdAt: AT,
      },
    })

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered({}, 50, 0)
    assert.equal(activities[0].userName, "E2E Main")
  })

  it("системные события подписаны «Система»", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.create({
      data: {
        id: "act-sys",
        type: "artist_added",
        userId: "system",
        userRole: "admin",
        title: "Добавлен артист",
        description: "Артист создан",
        metadata: { artistId: MAIN },
        createdAt: AT,
      },
    })

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered({}, 50, 0)
    assert.equal(activities[0].userName, "Система")
  })
})

describe("F-04: лента кабинета артиста", () => {
  it("показывает системные события про релизы и отчёты артиста", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.createMany({
      data: [
        {
          id: "act-feed-release",
          type: "release_added",
          userId: "system",
          userRole: "admin",
          title: "Добавлен релиз",
          description: 'Добавлен релиз "E2E Main Track One"',
          metadata: { artistId: MAIN, releaseId: "e2e-rel-main-1" },
          createdAt: AT,
        },
        {
          id: "act-feed-report",
          type: "report_received",
          userId: "system",
          userRole: "admin",
          title: "Назначен отчёт",
          description: "Отчёт за Q1 2026",
          metadata: { artistId: MAIN, reportId: "e2e-report-main-q1" },
          createdAt: AT,
        },
        {
          id: "act-feed-alien",
          type: "release_added",
          userId: "system",
          userRole: "admin",
          title: "Добавлен релиз",
          description: "Чужой релиз",
          metadata: { artistId: SOLO, releaseId: "e2e-rel-solo-1" },
          createdAt: AT,
        },
      ],
    })

    const { getActivitiesFiltered } = await import("@/lib/storage")

    // Прежний фильтр ленты — строго по userId + роль «artist». Оба события
    // записаны системой, и артист не видел ни одного: отсюда «показано
    // событий: 1» при четырёх релизах и двух отчётах.
    const old = await getActivitiesFiltered({ userId: MAIN, role: "artist" }, 50, 0)
    assert.deepEqual(old.activities, [], "фикстура не воспроизводит F-04")

    const { activities } = await getActivitiesFiltered({ artistGroupIds: [MAIN] }, 50, 0)
    const ids = activities.map((a) => a.id).sort()
    assert.deepEqual(ids, ["act-feed-release", "act-feed-report"])
  })

  it("показывает события привязанного профиля — кабинет у группы один", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.create({
      data: {
        id: "act-feed-linked",
        type: "playlist_found",
        userId: LINKED,
        userRole: "artist",
        title: "Добавлен плейлист",
        description: "Плейлист добавлен в ваш профиль",
        metadata: { artistId: LINKED, playlistId: "pl-1" },
        createdAt: AT,
      },
    })

    // Состав группы даёт getArtistGroupIds (покрыт в lib/artist-links.test.ts);
    // здесь важно, что лента читает по всем её id, а не по одному.
    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered({ artistGroupIds: [MAIN, LINKED] }, 50, 0)
    assert.deepEqual(activities.map((a) => a.id), ["act-feed-linked"])
  })

  it("чужие события в кабинет не попадают", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.create({
      data: {
        id: "act-feed-other",
        type: "release_added",
        userId: SOLO,
        userRole: "artist",
        title: "Добавлен релиз",
        description: "Чужой релиз",
        metadata: { artistId: SOLO, releaseId: "e2e-rel-solo-1" },
        createdAt: AT,
      },
    })

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered({ artistGroupIds: [MAIN] }, 50, 0)
    assert.deepEqual(activities, [])
  })
})

/**
 * Б-24: артист видел внутреннюю бухгалтерию лейбла. `advance_issued` пишется
 * на админа, но с `metadata.artistId` артиста — и по правилу F-04 (лента
 * кабинета читает и по метаданным) приезжала артисту в браузер. Состав ленты
 * артиста по решению 0-б — статусы релизов, плейлисты, отчётность.
 */
describe("Б-24: лента артиста без чужой бухгалтерии", () => {
  async function seedArtistFeedFixture() {
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.createMany({
      data: [
        {
          // Форма ровно как у app/api/advances/route.ts: актор — админ,
          // артист только в метаданных.
          id: "act-advance-issued",
          type: "advance_issued",
          userId: ADMIN,
          userRole: "admin",
          title: "Аванс выдан",
          description: "E2E Main: аванс 6 000 ₽ от 01.05.2026",
          metadata: { advanceId: "adv-1", artistId: MAIN, amount: 6000 },
          createdAt: AT,
        },
        {
          id: "act-advance-removed",
          type: "advance_removed",
          userId: ADMIN,
          userRole: "admin",
          title: "Аванс удалён",
          description: "E2E Main: аванс 6 000 ₽ от 01.05.2026",
          metadata: { advanceId: "adv-1", artistId: MAIN, amount: 6000 },
          createdAt: AT,
        },
        {
          id: "act-release-status",
          type: "release_status_updated",
          userId: MAIN,
          userRole: "artist",
          title: "Статус релиза обновлён",
          description: 'Релиз "E2E Main Track One" переведён в «Доставлен»',
          metadata: { artistId: MAIN, releaseId: "e2e-rel-main-1", status: "Доставлен" },
          createdAt: AT,
        },
        {
          id: "act-playlist",
          type: "playlist_found",
          userId: MAIN,
          userRole: "artist",
          title: "Добавлен плейлист",
          description: "«E2E Main Playlist One» · Spotify",
          metadata: { artistId: MAIN, playlistName: "E2E Main Playlist One" },
          createdAt: AT,
        },
      ],
    })
  }

  it("«Аванс выдан» есть в данных, но артисту не приходит", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    await seedArtistFeedFixture()

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered(
      { artistGroupIds: [MAIN], view: "artist" },
      50,
      0
    )
    const types = activities.map((a) => a.type)

    assert.equal(types.includes("advance_issued"), false, "аванс доехал до артиста")
    assert.equal(types.includes("advance_removed"), false, "удаление аванса доехало до артиста")
    assert.ok(types.includes("release_status_updated"), "статус релиза до артиста не доехал")
    assert.ok(types.includes("playlist_found"), "плейлист до артиста не доехал")
  })

  it("контроль: без вида аванс приходит — фикстура воспроизводит баг", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    await seedArtistFeedFixture()

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered({ artistGroupIds: [MAIN] }, 50, 0)
    assert.ok(
      activities.some((a) => a.type === "advance_issued"),
      "фикстура не воспроизводит Б-24: аванс не попадает в ленту даже без вида"
    )
  })

  it("вид не ломает правило группы: чужой аванс тоже не приходит", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    await prisma.activity.create({
      data: {
        id: "act-advance-alien",
        type: "advance_issued",
        userId: ADMIN,
        userRole: "admin",
        title: "Аванс выдан",
        description: "E2E Solo: аванс 1 000 ₽",
        metadata: { advanceId: "adv-2", artistId: SOLO, amount: 1000 },
        createdAt: AT,
      },
    })

    const { getActivitiesFiltered } = await import("@/lib/storage")
    const { activities } = await getActivitiesFiltered(
      { artistGroupIds: [MAIN], view: "artist" },
      50,
      0
    )
    assert.deepEqual(activities, [])
  })
})
