/**
 * Визуальный baseline личных кабинетов — эталон перед UI-overhaul.
 *
 * Снимает full-page-скрины всех экранов админ-ЛК и артист-ЛК в двух вьюпортах
 * (1440x900 и 390x844) под двумя ролями и раскладывает их по
 * `screens/baseline/{role}/{route}/{viewport}.png`. Дальше `visual-diff.ts`
 * сверяет с ними то, что получится после перевёрстки: план в `docs/ui-audit.md`
 * (волны этапа 4), вердикты — в `docs/ia-decisions.md`.
 *
 * Стенд — тот же локальный docker-контур, что у e2e, и логин той же механикой:
 * сессионная кука собирается `buildSessionCookieValue` из
 * `tests/e2e/support/session.ts` по AUTH_SECRET из `.env.e2e`, пользователи —
 * из `scripts/seed-e2e.ts`. Никакого UI-логина: он ограничен десятью попытками
 * на IP, и полсотни переходов упёрлись бы в 429.
 *
 * Usage:
 *   docker compose -f docker-compose.test.yml up -d
 *   pnpm test:db:migrate && pnpm seed:e2e && pnpm build
 *   npx tsx scripts/visual-baseline.ts
 *   npx tsx scripts/visual-baseline.ts --routes analytics,releases --out screens/after
 *
 * Флаги:
 *   --routes <a,b,c>   подстроки: снимаются роуты, чьи путь или slug содержат любую
 *   --out <dir>        корень вывода (по умолчанию screens/baseline)
 *   --base-url <url>   готовый стенд; без него скрипт сам поднимет `next start`
 */
import { existsSync, mkdirSync, writeFileSync } from "fs"
import { dirname, resolve } from "path"
import { spawn, type ChildProcess } from "child_process"
import { Client } from "pg"
import { chromium, type BrowserContext, type Page } from "@playwright/test"

import { loadEnvFile, loadTestEnvFiles, requireTestDatabaseUrl } from "../tests/support/env"
import { startMockSupabaseStorage, type MockStorage } from "../tests/support/mock-supabase-storage"
import { USERS, loginAs, type SeedUser } from "../tests/e2e/support/session"

// .env.e2e первым — ровно как в playwright.config.ts: значения стенда должны
// перебивать прод-креды из .env.local, иначе прогон уйдёт в боевой Supabase.
loadEnvFile(resolve(process.cwd(), ".env.e2e"))
loadTestEnvFiles()

// ---------------------------------------------------------------------------
// Каталог роутов
// ---------------------------------------------------------------------------

/** Артист, под которым снимается артист-ЛК (scripts/seed-e2e.ts). */
const ARTIST = USERS.main
/** Динамические сегменты — id из сида, числа там контрактные. */
const SEED = {
  artistId: "e2e-main-id",
  adminReleaseId: "e2e-rel-main-1",
  artistReleaseId: "e2e-rel-main-1",
  artistPlaylistId: "e2e-pl-main-1",
} as const

type Role = "admin" | "artist" | "public"

type RouteState = {
  /** Попадёт в имя файла: `{viewport}--{name}.png`. */
  name: string
  /** Возвращает false, если состояние на этом вьюпорте недостижимо (нет узла). */
  apply: (page: Page) => Promise<boolean>
}

type RouteSpec = {
  path: string
  states?: RouteState[]
}

/**
 * Период «Год» вместо дефолтных 30 дней: сид кладёт аналитику одной датой
 * (2026-06-15), в тридцатидневное окно она не попадает и график показывает
 * пустое состояние. На md+ период — ряд пилюль, на телефоне — Select.
 */
async function selectYearPeriod(page: Page): Promise<boolean> {
  const pill = page.getByRole("button", { name: "Год", exact: true }).first()
  if (await pill.isVisible().catch(() => false)) {
    await pill.click()
    return true
  }
  const combo = page.getByRole("combobox").filter({ hasText: /дней|Период/ }).first()
  if ((await combo.count()) === 0) return false
  await combo.click()
  await page.getByRole("option", { name: "Год", exact: true }).click()
  return true
}

/**
 * Тултип графика аналитики: recharts рисует его на mousemove по площади графика.
 * Двумя движениями — на вход без смещения recharts не реагирует.
 */
const chartTooltip: RouteState = {
  name: "chart-tooltip",
  apply: async (page) => {
    if (!(await selectYearPeriod(page))) return false
    await stabilize(page)
    const surface = page.locator(".recharts-surface").first()
    if ((await surface.count()) === 0) return false
    const box = await surface.boundingBox()
    if (!box) return false
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5)
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5)
    await page.locator(".recharts-tooltip-wrapper").first().waitFor({
      state: "visible",
      timeout: 5_000,
    })
    return true
  },
}

/** Фильтры релизов: в админке это Dialog за кнопкой «Фильтры». */
const releaseFilters: RouteState = {
  name: "filters-open",
  apply: async (page) => {
    const trigger = page.getByRole("button", { name: /Фильтры/ }).first()
    if ((await trigger.count()) === 0) return false
    await trigger.click()
    await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 5_000 })
    return true
  },
}

/**
 * Админ-ЛК. Не включены /dashboard/login и лендинг — публичные, вне скоупа
 * overhaul. /dashboard/admin/unregistered-reports в каталоге есть: экран
 * помечен «под удаление» (ia-decisions.md), но пока живой и мигрирует
 * волной 3, а значит должен сверяться со своим эталоном, как остальные.
 */
const ADMIN_ROUTES: RouteSpec[] = [
  { path: "/dashboard/admin/dashboard" },
  { path: "/dashboard/admin/analytics", states: [chartTooltip] },
  { path: "/dashboard/admin/reports" },
  { path: "/dashboard/admin/reports-generator" },
  { path: "/dashboard/admin/playlists" },
  { path: "/dashboard/admin/playlists/history" },
  { path: "/dashboard/admin/artists" },
  { path: "/dashboard/admin/artists/add" },
  { path: "/dashboard/admin/artists/bulk-add" },
  { path: `/dashboard/admin/artists/${SEED.artistId}` },
  { path: `/dashboard/admin/artists/${SEED.artistId}/reports` },
  { path: `/dashboard/admin/artists/${SEED.artistId}/payments` },
  { path: `/dashboard/admin/artists/${SEED.artistId}/releases` },
  { path: `/dashboard/admin/artists/${SEED.artistId}/playlists` },
  { path: "/dashboard/admin/releases", states: [releaseFilters] },
  { path: "/dashboard/admin/releases/add" },
  { path: `/dashboard/admin/releases/${SEED.adminReleaseId}` },
  { path: "/dashboard/admin/releases/koala-parser" },
  { path: "/dashboard/admin/releases/zvonko-parser" },
  { path: "/dashboard/admin/payments" },
  { path: "/dashboard/admin/activity" },
  { path: "/dashboard/admin/settings" },
  { path: "/dashboard/admin/unregistered-reports" },
]

/**
 * Артист-ЛК. Не включена `/dashboard/artist/[username]` — публичная визитка,
 * тоже под удаление. `/dashboard/artist` и `/dashboard/artist/analytics` —
 * серверные редиректы без собственной вёрстки, снимать нечего.
 */
const ARTIST_ROUTES: RouteSpec[] = [
  { path: `/dashboard/artist/${ARTIST.username}/dashboard` },
  // Фильтров как на админском списке здесь нет — только поиск и «Профиль»
  // (native select, его выпадашку рисует ОС и в скрин она не попадает).
  { path: `/dashboard/artist/${ARTIST.username}/releases` },
  { path: `/dashboard/artist/${ARTIST.username}/releases/${SEED.artistReleaseId}` },
  { path: `/dashboard/artist/${ARTIST.username}/analytics`, states: [chartTooltip] },
  { path: `/dashboard/artist/${ARTIST.username}/playlists` },
  { path: `/dashboard/artist/${ARTIST.username}/playlists/${SEED.artistPlaylistId}` },
  { path: `/dashboard/artist/${ARTIST.username}/payments` },
  { path: `/dashboard/artist/${ARTIST.username}/reports` },
  { path: `/dashboard/artist/${ARTIST.username}/settings` },
  { path: `/dashboard/artist/${ARTIST.username}/activity` },
]

/**
 * Публичные экраны кабинета — снимаются БЕЗ сессионной куки, как их видит гость.
 * Пока здесь один логин: до волны 4.4 он в каталог не входил («вне скоупа»),
 * из-за чего у единственного экрана кабинета не было эталона.
 */
const PUBLIC_ROUTES: RouteSpec[] = [{ path: "/dashboard/login" }]

const ROLES: Array<{
  role: Role
  /** null — контекст без логина (публичные экраны). */
  user: SeedUser | null
  routes: RouteSpec[]
  prefix: string
}> = [
  { role: "admin", user: USERS.admin, routes: ADMIN_ROUTES, prefix: "/dashboard/admin/" },
  {
    role: "artist",
    user: ARTIST,
    routes: ARTIST_ROUTES,
    prefix: `/dashboard/artist/${ARTIST.username}/`,
  },
  { role: "public", user: null, routes: PUBLIC_ROUTES, prefix: "/dashboard/" },
]

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
] as const

// ---------------------------------------------------------------------------
// Аргументы
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const out = {
    routes: [] as string[],
    outDir: "screens/baseline",
    baseUrl: process.env.VISUAL_BASE_URL?.trim() || "",
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`У флага ${arg} нет значения`)
      return v
    }
    if (arg === "--routes") out.routes = value().split(",").map((s) => s.trim()).filter(Boolean)
    else if (arg === "--out") out.outDir = value()
    else if (arg === "--base-url") out.baseUrl = value()
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "npx tsx scripts/visual-baseline.ts [--routes подстрока,...] [--out screens/baseline] [--base-url http://127.0.0.1:3000]"
      )
      process.exit(0)
    } else throw new Error(`Неизвестный аргумент: ${arg}`)
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

/** Директория скрина: путь без роль-префикса, слэши в подчёркивания. */
function slugFor(path: string, prefix: string): string {
  const tail = path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\//, "")
  return tail.replace(/\//g, "_") || "index"
}

function matchesFilter(path: string, slug: string): boolean {
  if (args.routes.length === 0) return true
  return args.routes.some((f) => path.includes(f) || slug.includes(f))
}

// ---------------------------------------------------------------------------
// Стенд
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "http://127.0.0.1:3000"

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    return res.status < 500
  } catch {
    return false
  }
}

/** Сид обязан быть на месте: без него скрины были бы пустыми экранами. */
async function assertSeeded(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 })
  await client.connect()
  try {
    const { rows } = await client.query(
      `SELECT count(*)::int AS c FROM "User" WHERE username = 'e2e-guard'`
    )
    if (rows[0]?.c !== 1) throw new Error("маркера e2e-guard в базе нет")
  } catch (err) {
    throw new Error(
      `База не готова (${(err as Error).message}). Поднимите стенд:\n` +
        "  docker compose -f docker-compose.test.yml up -d\n" +
        "  pnpm test:db:migrate && pnpm seed:e2e"
    )
  } finally {
    await client.end()
  }
}

async function startServer(baseUrl: string): Promise<ChildProcess> {
  const port = new URL(baseUrl).port || "3000"
  if (!existsSync(resolve(process.cwd(), ".next/BUILD_ID"))) {
    throw new Error("Нет сборки: сначала `pnpm build`, потом этот скрипт")
  }
  console.log(`[baseline] поднимаю next start на :${port}`)
  const child = spawn("pnpm", ["exec", "next", "start", "-p", port], {
    env: { ...process.env, PORT: port },
    stdio: "ignore",
  })
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start упал с кодом ${child.exitCode}`)
    if (await isUp(baseUrl)) return child
    await new Promise((r) => setTimeout(r, 700))
  }
  child.kill()
  throw new Error(`next start не поднялся за 120 с на ${baseUrl}`)
}

// ---------------------------------------------------------------------------
// Съёмка
// ---------------------------------------------------------------------------

/**
 * Гасим анимации и каретку: без этого один и тот же экран даёт разные пиксели
 * от прогона к прогону, и visual-diff.ts тонет в ложных срабатываниях.
 */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  html { scroll-behavior: auto !important; }
`

/**
 * Иконочный шрифт приезжает с fonts.googleapis.com и подключён с `display=swap`
 * (app/layout.tsx:59), поэтому до его загрузки на месте иконок стоит текст
 * лигатуры — «currency_rubl», «done_all», «menu». `document.fonts.ready` этого
 * не ловит: он резолвится до того, как шрифт реально дошёл, и один и тот же
 * экран давал то иконки, то слова — расхождение до 2 % между прогонами.
 */
const ICON_FONT = '24px "Material Symbols Outlined"'

async function stabilize(page: Page) {
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await page
    .waitForFunction(
      (font) => {
        if (!document.querySelector(".material-symbols-outlined")) return true
        document.fonts.load(font)
        return document.fonts.check(font)
      },
      ICON_FONT,
      { timeout: 20_000 }
    )
    .catch(() => {})
  // Спиннеры остаются в DOM с классом animate-spin даже с погашенной анимацией,
  // так что ждём именно их исчезновения, а не «конца анимации».
  await page
    .waitForFunction(() => !document.querySelector(".animate-spin"), null, { timeout: 20_000 })
    .catch(() => {})
  await page.waitForTimeout(400)
}

type Shot = { file: string; state?: string }
/**
 * fail — скрина нет или экран не тот (4xx/5xx, редирект, таймаут).
 * warn — скрин снят, но экран нажаловался в консоль или состояние не открылось:
 *        чинить это не задача baseline, но в docs/baseline-issues.md попадает.
 */
type Status = "ok" | "warn" | "fail"
type Result = {
  role: Role
  path: string
  slug: string
  viewport: string
  status: Status
  problems: string[]
  shots: Shot[]
}

async function captureRoute(
  page: Page,
  baseUrl: string,
  route: RouteSpec,
  slug: string,
  role: Role,
  viewport: string,
  outDir: string
): Promise<Result> {
  // Set, а не массив: один и тот же hydration-mismatch React кидает по разу на
  // каждый несовпавший узел, и без дедупликации отчёт заплывает копиями.
  const problems = new Set<string>()
  const shots: Shot[] = []
  const onPageError = (err: Error) => problems.add(`pageerror: ${err.message.slice(0, 160)}`)
  // Ответ 4xx/5xx на подзапросе консоль печатает без URL — ловим его отдельно,
  // иначе в отчёте остаётся бесполезное «Failed to load resource: 404».
  const onResponse = (res: { status(): number; url(): string }) => {
    const status = res.status()
    if (status < 400) return
    const url = res.url().replace(baseUrl, "")
    if (url === route.path) return
    problems.add(`подзапрос HTTP ${status}: ${url.slice(0, 140)}`)
  }
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() !== "error") return
    const text = msg.text()
    // Оборванные запросы — это мы сами: переключение состояния и уход со
    // страницы отменяют висящий fetch. К вёрстке отношения не имеет.
    if (/ERR_SOCKET_NOT_CONNECTED|ERR_ABORTED|net::ERR_FAILED/.test(text)) return
    // Дубль того, что onResponse уже записал с адресом.
    if (/^Failed to load resource/.test(text)) return
    problems.add(`console: ${text.slice(0, 160)}`)
  }
  page.on("pageerror", onPageError)
  page.on("console", onConsole)
  page.on("response", onResponse)

  const dir = resolve(process.cwd(), outDir, role, slug)
  mkdirSync(dir, { recursive: true })

  try {
    const response = await page.goto(`${baseUrl}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    })
    const status = response?.status()
    if (status && status >= 400) problems.add(`HTTP ${status}`)

    await stabilize(page)

    const landed = new URL(page.url()).pathname
    // Сам экран логина — легальная цель (роль public), а не выброшенная сессия.
    if (landed === "/dashboard/login" && route.path !== "/dashboard/login") {
      problems.add("редирект на /dashboard/login — сессия не принята (AUTH_SECRET стенда?)")
    } else if (landed !== route.path) {
      problems.add(`редирект на ${landed}`)
    }

    const file = `${outDir}/${role}/${slug}/${viewport}.png`
    await page.screenshot({ path: resolve(process.cwd(), file), fullPage: true })
    shots.push({ file })

    for (const state of route.states ?? []) {
      try {
        const applied = await state.apply(page)
        if (!applied) {
          problems.add(`состояние «${state.name}» недостижимо: нужного узла на экране нет`)
          continue
        }
        await page.waitForTimeout(300)
        const stateFile = `${outDir}/${role}/${slug}/${viewport}--${state.name}.png`
        await page.screenshot({ path: resolve(process.cwd(), stateFile), fullPage: true })
        shots.push({ file: stateFile, state: state.name })
      } catch (err) {
        problems.add(`состояние «${state.name}»: ${(err as Error).message.split("\n")[0]}`)
      }
    }
  } catch (err) {
    problems.add((err as Error).message.split("\n")[0])
  } finally {
    page.off("pageerror", onPageError)
    page.off("console", onConsole)
    page.off("response", onResponse)
  }

  // Экран, который отрисовался и наругался в консоль, — это находка, а не
  // сломанный роут: скрин снят и годится в эталон. Роут валят только вещи,
  // после которых снимать нечего или снято не то.
  const list = [...problems]
  const fatal = list.some(
    (p) => p.startsWith("HTTP ") || p.startsWith("редирект") || p.startsWith("page.goto")
  )
  const status: Status =
    shots.length === 0 || fatal ? "fail" : list.length > 0 ? "warn" : "ok"

  return { role, path: route.path, slug, viewport, status, problems: list, shots }
}

// ---------------------------------------------------------------------------
// Отчёт
// ---------------------------------------------------------------------------

function printTable(results: Result[]) {
  type Row = { role: string; path: string; status: string; files: string }
  const byRoute = new Map<string, Result[]>()
  for (const r of results) {
    const key = `${r.role} ${r.path}`
    byRoute.set(key, [...(byRoute.get(key) ?? []), r])
  }

  const rows: Row[] = []
  for (const [key, group] of byRoute) {
    const [role, path] = key.split(" ")
    const files = group
      .flatMap((g) => g.shots.map((s) => s.file.split("/").pop()!))
      .join(", ")
    const failed = group.filter((g) => g.status === "fail")
    const warned = group.filter((g) => g.status === "warn")
    const status =
      failed.length > 0
        ? `fail (${failed.map((f) => f.viewport).join(", ")})`
        : warned.length > 0
          ? `warn (${warned.map((w) => w.viewport).join(", ")})`
          : "ok"
    rows.push({ role, path, status, files: files || "—" })
  }

  const head: Row = { role: "РОЛЬ", path: "РОУТ", status: "СТАТУС", files: "ФАЙЛЫ" }
  const width = (k: keyof Row) => Math.max(...[head, ...rows].map((r) => r[k].length))
  const w = { role: width("role"), path: width("path"), status: width("status") }
  const line = (r: Row) =>
    `${r.role.padEnd(w.role)}  ${r.path.padEnd(w.path)}  ${r.status.padEnd(w.status)}  ${r.files}`

  console.log("")
  console.log(line(head))
  console.log("─".repeat(w.role + w.path + w.status + 6 + 20))
  for (const r of rows) console.log(line(r))
}

function printProblems(results: Result[]) {
  const withProblems = results.filter((r) => r.problems.length > 0)
  if (withProblems.length === 0) return
  console.log("\nПроблемы:")
  for (const r of withProblems) {
    console.log(`  ${r.role} ${r.path} @${r.viewport}`)
    for (const p of r.problems) console.log(`    · ${p}`)
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = requireTestDatabaseUrl()
  await assertSeeded(databaseUrl)

  const baseUrl = (args.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "")
  let server: ChildProcess | undefined
  if (await isUp(baseUrl)) {
    console.log(`[baseline] использую уже поднятый ${baseUrl}`)
  } else if (args.baseUrl) {
    throw new Error(`Стенд ${baseUrl} недоступен`)
  } else {
    server = await startServer(baseUrl)
  }

  // Тот же стаб, что в tests/e2e/global-setup.ts: без него роуты отчётов уйдут
  // в настоящий Supabase — lib/supabase.ts при пустых переменных подставляет
  // захардкоженный прод-URL.
  let storage: MockStorage | undefined
  if (!args.baseUrl) {
    const port = Number(process.env.E2E_STORAGE_PORT || 54330)
    try {
      storage = await startMockSupabaseStorage(port)
      console.log(`[baseline] стаб Supabase Storage на ${storage.url}`)
    } catch (err) {
      // Прерванный прогон e2e оставляет стаб висеть на том же порту. Если он
      // отвечает — берём его, иначе порт занят чем-то чужим и это ошибка.
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err
      if (!(await isUp(`http://127.0.0.1:${port}/storage/v1/bucket`))) {
        throw new Error(`Порт ${port} занят не стабом Storage — освободите его`)
      }
      console.log(`[baseline] переиспользую стаб Storage на :${port}`)
    }
  }

  const browser = await chromium.launch()
  const results: Result[] = []

  try {
    for (const { role, user, routes, prefix } of ROLES) {
      const planned = routes
        .map((route) => ({ route, slug: slugFor(route.path, prefix) }))
        .filter(({ route, slug }) => matchesFilter(route.path, slug))
      if (planned.length === 0) continue

      for (const viewport of VIEWPORTS) {
        // Отдельный контекст на вьюпорт: часть кабинета ветвится по замеренной
        // в JS ширине (hooks/use-mobile-detector.ts), и простой resize уже
        // отрисованной страницы дал бы не то состояние, что при заходе с телефона.
        const context: BrowserContext = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
          locale: "ru-RU",
          timezoneId: "Europe/Moscow",
        })
        if (user) await loginAs(context, user, baseUrl)
        const page = await context.newPage()

        for (const { route, slug } of planned) {
          process.stdout.write(`  ${role} ${viewport.name} ${route.path} … `)
          const result = await captureRoute(
            page,
            baseUrl,
            route,
            slug,
            role,
            viewport.name,
            args.outDir
          )
          results.push(result)
          console.log(
            result.status === "ok" ? "ok" : `${result.status.toUpperCase()} — ${result.problems[0] ?? ""}`
          )
        }

        await context.close()
      }
    }
  } finally {
    await browser.close()
    await storage?.close()
    server?.kill()
  }

  const manifestPath = resolve(process.cwd(), args.outDir, "manifest.json")
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        viewports: VIEWPORTS.map((v) => v.name),
        routes: results.map(({ role, path, viewport, status, problems, shots }) => ({
          role,
          path,
          viewport,
          status,
          problems,
          files: shots.map((s) => s.file),
        })),
      },
      null,
      2
    ) + "\n"
  )

  printTable(results)
  printProblems(results)

  const failed = results.filter((r) => r.status === "fail")
  const warned = results.filter((r) => r.status === "warn")
  const shots = results.reduce((n, r) => n + r.shots.length, 0)
  console.log(
    `\nСнято ${shots} скринов. Роут-вьюпортов: ok ${results.length - failed.length - warned.length}, ` +
      `warn ${warned.length}, fail ${failed.length} из ${results.length}. ` +
      `Манифест: ${args.outDir}/manifest.json`
  )
  if (failed.length + warned.length > 0) {
    console.log("Здесь ничего не чиним — находки уходят в docs/baseline-issues.md")
  }
}

main().catch((err) => {
  console.error(`\n${(err as Error).message}`)
  process.exit(1)
})
