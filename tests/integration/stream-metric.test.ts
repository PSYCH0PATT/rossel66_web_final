/**
 * Метрика стримов кабинета против настоящего Postgres (F-18).
 *
 * Окно периода покрыто чистыми тестами (lib/stream-window.test.ts). Здесь —
 * вторая, более дорогая половина бага: ИСТОЧНИК. Дашборд спрашивал аналитику
 * строго по `artistId`, страница аналитики — через `cabinetWhere`, который
 * добавляет коллабы без artistId и профили группы. Одна метрика выходила
 * разной: «60» против «107» у skaya, «335K» против «364 590» у rompy.
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
/** Окно вокруг даты сидовых строк аналитики (2026-06-15). */
const WINDOW = { startDate: "2026-06-01", endDate: "2026-06-30" }

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

async function mainArtist() {
  const { prisma } = await import("@/lib/prisma")
  const artist = await prisma.user.findUniqueOrThrow({
    where: { id: MAIN },
    select: { id: true, name: true, username: true },
  })
  return artist
}

describe("F-18: дашборд и аналитика считают одну метрику", () => {
  it("прежний источник дашборда занижал метрику — фикстура воспроизводит расхождение", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { getStreamAnalytics } = await import("@/lib/flash-storage")

    // Как дашборд просил до фикса: строго artistId. Коллаб «E2E Main & E2E
    // Linked» (700) записан без artistId и в этот фильтр не попадает.
    const strict = await getStreamAnalytics({ artistId: MAIN, ...WINDOW })
    assert.equal(strict.totalStreams, 1500, "сид изменился — фикстура больше не воспроизводит F-18")
  })

  it("дашборд получает ровно то же число, что и страница аналитики", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { buildCabinetStreamFilters } = await import("@/lib/analytics-request-filters")
    const { getStreamAnalytics } = await import("@/lib/flash-storage")

    const artist = await mainArtist()
    const dashboard = await getStreamAnalytics(await buildCabinetStreamFilters(artist, WINDOW))
    const strict = await getStreamAnalytics({ artistId: MAIN, ...WINDOW })

    // Состав группы — общая с другими сюитами точка состояния (e2e её меняет),
    // поэтому сверяем её явно, чтобы падение не выглядело загадочным.
    const { getArtistGroupIds } = await import("@/lib/artist-links")
    assert.deepEqual(
      await getArtistGroupIds(MAIN),
      [MAIN],
      "остались привязанные профили — прогоните pnpm seed:e2e"
    )

    // Свои 1500 + коллаб 700, где артист узнаётся по имени. Чужие 42 — мимо.
    assert.equal(dashboard.totalStreams, 2200)
    assert.ok(
      dashboard.totalStreams > strict.totalStreams,
      "источники совпали — тест перестал что-либо проверять"
    )
  })

  it("страница дашборда и API аналитики строят один и тот же фильтр", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { buildAnalyticsFiltersFromRequest, buildArtistDashboardStreamFilters } = await import(
      "@/lib/analytics-request-filters"
    )
    const { getStreamAnalytics } = await import("@/lib/flash-storage")
    const { STREAM_WINDOW_DAYS } = await import("@/lib/stream-window")

    // Ровно то, что зовёт app/dashboard/artist/[username]/dashboard/page.tsx.
    const now = new Date("2026-06-20T09:00:00Z")
    const viaDashboard = await buildArtistDashboardStreamFilters(
      await mainArtist(),
      STREAM_WINDOW_DAYS,
      now
    )
    const viaApi = await buildAnalyticsFiltersFromRequest(
      { id: MAIN, role: "artist" },
      new URLSearchParams({
        startDate: viaDashboard.startDate!,
        endDate: viaDashboard.endDate!,
      })
    )

    assert.deepEqual(viaDashboard.cabinetWhere, viaApi.cabinetWhere, "источники разошлись")
    assert.equal(
      (await getStreamAnalytics(viaDashboard)).totalStreams,
      (await getStreamAnalytics(viaApi)).totalStreams
    )
  })

  it("окно дашборда — московские 30 дней, как пресет «30д» в аналитике", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { buildArtistDashboardStreamFilters } = await import("@/lib/analytics-request-filters")
    const { analyticsStreamWindow, STREAM_WINDOW_DAYS } = await import("@/lib/stream-window")

    const now = new Date("2026-06-20T21:30:00Z")
    const filters = await buildArtistDashboardStreamFilters(await mainArtist(), STREAM_WINDOW_DAYS, now)
    const preset = analyticsStreamWindow(`${STREAM_WINDOW_DAYS}d`, now)

    assert.equal(filters.startDate, preset.startDate)
    assert.equal(filters.endDate, preset.endDate)
  })
})

/**
 * F-05, артист-вариант: «ось не монотонна — сверху вниз 8K, 4K, 9K, 5K, 0,
 * тултип 15 121 при верхней метке 8K» (docs/ui-visual-findings.md:60).
 *
 * Такие подписи recharts выдаёт, только если ось перестала быть числовой —
 * то есть в данных пришли не числа, либо точки не отсортированы по дате.
 * Это контракт данных графика, и проверять его нужно на настоящей выборке.
 */
describe("F-05: контракт данных графика стримов", () => {
  it("streamsByDay отдаёт числа и точки, упорядоченные по дате", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { prisma } = await import("@/lib/prisma")
    const { getStreamAnalytics } = await import("@/lib/flash-storage")

    // Несколько дней подряд: на одной точке порядок не проверить.
    await prisma.streamAnalytics.deleteMany({ where: { id: { startsWith: "f05-" } } })
    await prisma.streamAnalytics.createMany({
      data: ["2026-06-12", "2026-06-14", "2026-06-13"].map((day, i) => ({
        id: `f05-${day}`,
        trackName: `F05 Track ${i}`,
        trackArtist: "E2E Main",
        artistId: MAIN,
        isrc: `F05TEST000${i}`,
        albumTitle: "F05 Album",
        date: new Date(day),
        dsp: "Spotify",
        length: "full",
        source: "e2e",
        streams: 15121 - i * 5000,
      })),
    })

    try {
      const { streamsByDay } = await getStreamAnalytics({ artistId: MAIN, ...WINDOW })

      assert.ok(streamsByDay.length >= 3, "фикстура не доехала")
      for (const point of streamsByDay) {
        assert.equal(typeof point.streams, "number", `не число: ${JSON.stringify(point)}`)
        assert.ok(Number.isFinite(point.streams), `не конечное: ${JSON.stringify(point)}`)
      }
      const dates = streamsByDay.map((p) => p.date)
      assert.deepEqual(dates, [...dates].sort(), "точки не упорядочены по дате")
    } finally {
      await prisma.streamAnalytics.deleteMany({ where: { id: { startsWith: "f05-" } } })
    }
  })
})

/**
 * B-12 (docs/backlog.md): стенд обязан попадать в окно графика по умолчанию.
 *
 * Окно календарное — «последние 30 дней от now()» — и таким остаётся намеренно:
 * если считать его от последней имеющейся строки, сломанный импорт flash
 * выглядел бы здоровым (F-18). Значит, попадать в окно должен сид: даты
 * каталожных строк скользят вместе с днём сидирования. Этот тест падает, если
 * их снова прибьют к календарю — иначе через пару недель экраны аналитики
 * начнут сниматься пустыми, и визуальные прогоны перестанут что-либо
 * доказывать.
 */
describe("B-12: сид попадает в окно графика по умолчанию", () => {
  it("в окне «30 дней от сегодня» есть данные, а не пустой экран", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { getStreamAnalytics } = await import("@/lib/flash-storage")
    const { dashboardStreamWindow } = await import("@/lib/stream-window")

    const window = dashboardStreamWindow()
    const data = await getStreamAnalytics(window)

    assert.ok(
      data.totalStreams > 0,
      `в окне ${window.startDate}…${window.endDate} нет ни одной строки: ` +
        "даты в scripts/seed-e2e.ts снова прибиты к календарю"
    )
    assert.ok(
      data.streamsByDay.length >= 7,
      `в окне только ${data.streamsByDay.length} точек — график выродится в прямую`
    )
    assert.ok(
      data.streamsByTrack.length > 10,
      `в окне ${data.streamsByTrack.length} треков — «топ-10 + Все треки» показать не на чем`
    )
  })

  it("кабинет артиста тоже попадает в окно, а не открывается пустым", async (t) => {
    if (skipSuite) return t.skip("нет базы")
    const { buildCabinetStreamFilters } = await import("@/lib/analytics-request-filters")
    const { getStreamAnalytics } = await import("@/lib/flash-storage")
    const { dashboardStreamWindow } = await import("@/lib/stream-window")

    const window = dashboardStreamWindow()
    const data = await getStreamAnalytics(await buildCabinetStreamFilters(await mainArtist(), window))

    assert.ok(
      data.totalStreams > 0,
      `у артиста в окне ${window.startDate}…${window.endDate} нет строк: ` +
        "его свежий ряд в scripts/seed-e2e.ts (freshMainArtistAnalytics) снова прибит к календарю"
    )
  })
})
