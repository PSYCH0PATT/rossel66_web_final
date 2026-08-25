/**
 * Интеграционные тесты денежной логики отчётов против настоящего Postgres.
 *
 * Здесь проверяется то, что нельзя проверить чистой функцией: SQL-условия,
 * дедупликация по кварталам, гашение отчётов связанных профилей и агрегация
 * аналитики по группе. Именно в этих местах ошибка стоила бы артисту денег.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.test.yml up -d
 *   pnpm test:db:migrate && pnpm seed:e2e
 *   pnpm test:integration
 */
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { loadTestEnvFiles, requireTestDatabaseUrl } from "../support/env"

loadTestEnvFiles()
const TEST_DB =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rossel:rossel@127.0.0.1:54329/rossel_test"
process.env.DATABASE_URL = TEST_DB
process.env.DIRECT_URL = TEST_DB
// Зеркало Buildin в этих тестах не участвует: проверяем свою логику, не доставку.
process.env.BUILDIN_DUAL_WRITE = "false"
process.env.PYRUS_WRITE_DISABLED = "true"

const MAIN = "e2e-main-id"
const LINKED = "e2e-linked-id"
const SOLO = "e2e-solo-id"

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

/** Возвращает базу к состоянию сида по частям, которые тесты меняют. */
async function resetState() {
  const { prisma } = await import("@/lib/prisma")
  await prisma.advance.deleteMany({})
  await prisma.user.updateMany({ where: { mainArtistId: { not: null } }, data: { mainArtistId: null } })
  await prisma.report.updateMany({
    where: { id: { in: ["e2e-report-linked-q3", "e2e-report-main-q1", "e2e-report-main-q2"] } },
    data: { isRegistered: true, isPaid: false },
  })
}

// Сюит — единственный во всём `tests/integration`, кто ставит AKA-связку
// `e2e-linked-id → e2e-main-id`, а stream-metric.test.ts требует обратного:
// getArtistGroupIds(MAIN) === [MAIN]. От гонки между файлами защищает не этот хук, а
// порядок запуска (`test:integration` гоняет эту пару последовательно) — сегодня
// последний тест сюита и так оставляет связки снятыми. Хук держит это свойство явным:
// resetState() зовётся ПЕРЕД каждым тестом, и без него «база чиста на выходе» было бы
// случайным свойством последнего теста, а не правилом файла.
after(async () => {
  if (skipSuite) return
  await resetState()
})

describe("баланс артиста и авансы", () => {
  it("считает начисленное по всем кварталам", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { getArtistBalance } = await import("@/lib/storage")
    const balance = await getArtistBalance(MAIN)
    // 2000 (Q1) + 5000 (Q2) из сида
    assert.equal(balance.totalBalance, 7000)
    assert.equal(balance.availableForPayout, 7000)
    assert.equal(balance.advanceTotal, 0)
  })

  it("гасит аванс только отчётами, пришедшими после его выдачи", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getArtistBalance } = await import("@/lib/storage")

    // Аванс между кварталами: Q1 (апрель) заработан раньше и в погашение не идёт,
    // Q2 (июль) — идёт.
    await prisma.advance.create({
      data: { artistId: MAIN, amount: 6000, issuedAt: new Date("2026-05-01") },
    })

    const balance = await getArtistBalance(MAIN)
    assert.equal(balance.advanceTotal, 6000)
    assert.equal(balance.advanceRecouped, 5000, "погасить должен только Q2")
    assert.equal(balance.advanceRemaining, 1000)
    // 7000 начислено − 5000 ушло в погашение = 2000, это ниже порога 3000
    assert.equal(balance.availableForPayout, 0)
  })

  it("возвращает деньги к выплате, когда аванс погашен целиком", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getArtistBalance } = await import("@/lib/storage")

    await prisma.advance.create({
      data: { artistId: MAIN, amount: 3000, issuedAt: new Date("2026-05-01") },
    })
    const balance = await getArtistBalance(MAIN)
    assert.equal(balance.advanceRecouped, 3000)
    assert.equal(balance.advanceRemaining, 0)
    assert.equal(balance.availableForPayout, 4000)
  })

  it("удаление аванса возвращает баланс в исходное состояние", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getArtistBalance } = await import("@/lib/storage")

    const advance = await prisma.advance.create({
      data: { artistId: MAIN, amount: 6000, issuedAt: new Date("2026-05-01") },
    })
    assert.equal((await getArtistBalance(MAIN)).availableForPayout, 0)

    await prisma.advance.delete({ where: { id: advance.id } })
    const after = await getArtistBalance(MAIN)
    assert.equal(after.advanceTotal, 0)
    assert.equal(after.availableForPayout, 7000)
  })

  it("не считает в балансе отчёт, погашенный merged-прогоном", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getArtistBalance } = await import("@/lib/storage")

    assert.equal((await getArtistBalance(LINKED)).totalBalance, 800)
    await prisma.report.update({
      where: { id: "e2e-report-linked-q3" },
      data: { isRegistered: false },
    })
    assert.equal(
      (await getArtistBalance(LINKED)).totalBalance,
      0,
      "погашенный отчёт не должен оставаться в балансе"
    )
  })
})

describe("гашение отчётов связанных профилей", () => {
  it("гасит отчёт привязанного за тот же квартал и не трогает чужие", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { supersedeLinkedProfileReports } = await import("@/lib/storage")

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    const count = await supersedeLinkedProfileReports(MAIN, "Q3", 2026)
    assert.equal(count, 1)

    const linkedReport = await prisma.report.findUnique({ where: { id: "e2e-report-linked-q3" } })
    assert.equal(linkedReport?.isRegistered, false)

    const soloReport = await prisma.report.findUnique({ where: { id: "e2e-report-solo-q1" } })
    assert.equal(soloReport?.isRegistered, true, "чужой отчёт трогать нельзя")

    const mainReport = await prisma.report.findUnique({ where: { id: "e2e-report-main-q1" } })
    assert.equal(mainReport?.isRegistered, true, "отчёт самого главного трогать нельзя")
  })

  it("не трогает другие кварталы и повторно ничего не гасит", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { supersedeLinkedProfileReports } = await import("@/lib/storage")

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    assert.equal(await supersedeLinkedProfileReports(MAIN, "Q1", 2026), 0, "в Q1 у привязанного отчёта нет")
    assert.equal(await supersedeLinkedProfileReports(MAIN, "Q3", 2026), 1)
    assert.equal(await supersedeLinkedProfileReports(MAIN, "Q3", 2026), 0, "повторный вызов — ноль")
  })

  it("без привязки не гасит ничего", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { supersedeLinkedProfileReports } = await import("@/lib/storage")
    assert.equal(await supersedeLinkedProfileReports(MAIN, "Q3", 2026), 0)
  })
})

describe("группа профилей и аналитика", () => {
  it("собирает группу главного и не даёт доступ снизу вверх", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getArtistGroup, getArtistGroupIds } = await import("@/lib/artist-links")

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    const group = await getArtistGroup(MAIN)
    assert.equal(group.length, 2)
    assert.equal(group[0].id, MAIN, "главный должен идти первым")

    const linkedGroup = await getArtistGroup(LINKED)
    assert.deepEqual(
      linkedGroup.map((m) => m.id),
      [LINKED],
      "связь односторонняя"
    )

    assert.deepEqual((await getArtistGroupIds(MAIN)).sort(), [LINKED, MAIN].sort())
  })

  it("кабинет главного агрегирует стримы группы, коллаб считается один раз", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { buildCabinetStreamAnalyticsWhere } = await import("@/lib/analytics-artist-match")

    const sum = async (userId: string, name: string, username: string) => {
      const where = await buildCabinetStreamAnalyticsWhere(userId, name, username)
      const rows = await prisma.streamAnalytics.aggregate({
        where: where as never,
        _sum: { streams: true },
      })
      return rows._sum.streams ?? 0
    }

    // До привязки: свои 1500 + коллаб 700 (имя главного в строке коллаба) +
    // свежий ряд 1400 (B-12: строки за последние 14 дней, чтобы кабинет
    // артиста не снимался пустым).
    assert.equal(await sum(MAIN, "E2E Main", "e2e-main"), 3600)

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    // После: + строки привязанного (300). Коллаб — та же одна строка, не удваивается.
    assert.equal(await sum(MAIN, "E2E Main", "e2e-main"), 3900)

    // Кабинет привязанного показывает только его: свои 300 + коллаб 700.
    assert.equal(await sum(LINKED, "E2E Linked", "e2e-linked"), 1000)

    // Посторонний артист чужих стримов не видит.
    assert.equal(await sum(SOLO, "E2E Solo", "e2e-solo"), 0)
  })

  it("выпадашка админа схлопывает привязанный профиль в главного без двойного счёта", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { getAvailableArtists } = await import("@/lib/flash-storage")

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    const options = await getAvailableArtists()
    const main = options.find((o) => o.artistId === MAIN)
    const linked = options.find((o) => o.artistId === LINKED)

    assert.ok(main, "главный должен быть в списке")
    assert.equal(linked, undefined, "привязанный профиль отдельной опцией быть не должен")
    // 1500 своих + 1400 свежих + 300 привязанного + 700 коллаба ОДИН раз.
    // Без дедупа коллаба было бы на 700 больше.
    assert.equal(main!.totalStreams, 3900)

    // Имя вне ростера остаётся отдельной строкой — его привязывают вручную.
    const outsider = options.find((o) => o.trackArtist === "Совсем Чужой Артист")
    assert.ok(outsider, "нераспознанное имя должно остаться в списке")
    assert.equal(outsider!.artistId, null)
  })
})

describe("плейлисты кабинета", () => {
  it("собирает плейлисты всей группы и помечает профиль каждой строки", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { loadArtistPlaylistsUncached } = await import("@/lib/cached-dashboard")

    // До привязки — только свои две.
    const own = await loadArtistPlaylistsUncached(MAIN)
    assert.equal(own.length, 2)
    assert.ok(
      own.every((p) => p.profile_id === MAIN),
      "у своих строк должен стоять свой профиль"
    )

    await prisma.user.update({ where: { id: LINKED }, data: { mainArtistId: MAIN } })

    // После привязки кабинет группы показывает и плейлист привязанного.
    const grouped = await loadArtistPlaylistsUncached(MAIN)
    assert.equal(grouped.length, 3)

    // Профиль проставлен верно — на нём держится фильтр «Профиль» в кабинете.
    const byProfile = new Map<string, number>()
    for (const p of grouped) {
      byProfile.set(p.profile_id, (byProfile.get(p.profile_id) ?? 0) + 1)
    }
    assert.equal(byProfile.get(MAIN), 2)
    assert.equal(byProfile.get(LINKED), 1)
    assert.ok(
      grouped.every((p) => p.profile_name.length > 0),
      "имя профиля нужно для подписи в фильтре"
    )
  })
})

describe("ручное назначение отчёта", () => {
  it("делает отчёт видимым артисту", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { moveReportToArtist } = await import("@/lib/storage")

    await prisma.report.update({
      where: { id: "e2e-report-linked-q3" },
      data: { isRegistered: false, artistId: null },
    })

    await moveReportToArtist("e2e-report-linked-q3", SOLO)
    const moved = await prisma.report.findUnique({ where: { id: "e2e-report-linked-q3" } })
    assert.equal(moved?.artistId, SOLO)
    assert.equal(moved?.isRegistered, true, "иначе отчёт остаётся невидимым в кабинете")

    await prisma.report.update({
      where: { id: "e2e-report-linked-q3" },
      data: { artistId: LINKED, artistName: "E2E Linked" },
    })
  })
})

describe("удаление артиста", () => {
  it("снимает привязки, чтобы не осталось ссылки в никуда", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    await resetState()
    const { prisma } = await import("@/lib/prisma")
    const { deleteUser } = await import("@/lib/storage")

    const temp = await prisma.user.create({
      data: {
        id: "e2e-temp-main",
        username: "e2e-temp-main",
        name: "E2E Temp Main",
        email: "",
        role: "artist",
        password: "x",
      },
    })
    await prisma.user.update({ where: { id: SOLO }, data: { mainArtistId: temp.id } })

    await deleteUser(temp.id)

    const solo = await prisma.user.findUnique({ where: { id: SOLO } })
    assert.equal(solo?.mainArtistId, null, "ссылка на удалённого артиста должна быть снята")
  })
})
