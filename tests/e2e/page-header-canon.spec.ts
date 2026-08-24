/**
 * @smoke — канон шапки страницы (C-01, docs/ui-audit.md).
 *
 * Волны 1–4 пересадили экраны на PageHeader, но композиция канонизирована не
 * была: `size="md"` на 11 экранах против `lg` на 18 давал три размера H1, а
 * собственные контейнеры страниц (`max-w-7xl mx-auto p-6 md:p-10`) поверх
 * шелловского сдвигали заголовок влево-вправо на 40px. Этот тест — попиксельный
 * замок: если кто-то снова задаст странице свою рамку или свой размер
 * заголовка, координаты H1 разъедутся и тест упадёт.
 *
 * Что проверяется:
 * - размер шрифта H1 одинаков на всех экранах обоих кабинетов;
 * - левая координата H1 одинакова (ширину и поля задаёт DashboardShell);
 * - верхняя граница H1 одинакова внутри группы «без крошки» и внутри группы
 *   «с крошкой» (у второй заголовок ниже ровно на высоту крошки, это канон,
 *   а не расхождение);
 * - у самой шапки `padding-bottom: 32px` и `margin-bottom: 0` — отступ до
 *   контента даёт `space-y-8` корня страницы, а не класс на шапке.
 *
 * Вьюпорт — дефолтный Desktop Chrome (1280): ниже 1024 PageHeader сам ужимает
 * заголовок общим `clamp()` (B-09 — раньше это делал `dashboard.css`), и
 * разницу размеров там не увидеть в принципе.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"

import { USERS, loginAs } from "./support/session"

const BASE = "http://127.0.0.1:3000"
/** Допуск: сглаживание шрифта и субпиксельная раскладка. */
const TOL = 2

const ARTIST = USERS.main.username
const SEED_RELEASE = "e2e-rel-main-1"

/** Экраны без крошки: H1 стоит первым элементом шапки. */
const WITHOUT_CRUMB = [
  { role: "admin", path: "/dashboard/admin/dashboard" },
  { role: "admin", path: "/dashboard/admin/activity" },
  { role: "admin", path: "/dashboard/admin/settings" },
  { role: "artist", path: `/dashboard/artist/${ARTIST}/dashboard` },
  { role: "artist", path: `/dashboard/artist/${ARTIST}/playlists` },
  { role: "artist", path: `/dashboard/artist/${ARTIST}/activity` },
] as const

/** Экраны с крошкой «← К списку»: H1 ниже ровно на её высоту. */
const WITH_CRUMB = [
  { role: "admin", path: "/dashboard/admin/artists/add" },
  { role: "admin", path: `/dashboard/admin/releases/${SEED_RELEASE}` },
  { role: "artist", path: `/dashboard/artist/${ARTIST}/releases/${SEED_RELEASE}` },
] as const

type Geometry = {
  path: string
  left: number
  top: number
  fontSize: number
  headerPaddingBottom: number
  headerMarginBottom: number
}

async function measure(page: Page, path: string): Promise<Geometry> {
  await page.goto(path)
  const h1 = page.locator("h1").first()
  await h1.waitFor({ state: "visible" })
  // Шрифты грузятся асинхронно: до их подмены метрики другие.
  await page.evaluate(() => document.fonts.ready)
  const box = await h1.boundingBox()
  if (!box) throw new Error(`${path}: у H1 нет геометрии`)
  const styles = await h1.evaluate((el) => {
    const header = el.closest("header")
    const hs = header ? getComputedStyle(header) : null
    return {
      fontSize: parseFloat(getComputedStyle(el).fontSize),
      paddingBottom: hs ? parseFloat(hs.paddingBottom) : NaN,
      marginBottom: hs ? parseFloat(hs.marginBottom) : NaN,
    }
  })
  return {
    path,
    left: box.x,
    top: box.y,
    fontSize: styles.fontSize,
    headerPaddingBottom: styles.paddingBottom,
    headerMarginBottom: styles.marginBottom,
  }
}

async function collect(browser: Browser, screens: readonly { role: string; path: string }[]) {
  const contexts: Record<string, BrowserContext> = {}
  const out: Geometry[] = []
  try {
    for (const screen of screens) {
      if (!contexts[screen.role]) {
        const ctx = await browser.newContext({ baseURL: BASE })
        await loginAs(ctx, screen.role === "admin" ? USERS.admin : USERS.main, BASE)
        contexts[screen.role] = ctx
      }
      const page = await contexts[screen.role].newPage()
      try {
        out.push(await measure(page, screen.path))
      } finally {
        await page.close()
      }
    }
  } finally {
    await Promise.all(Object.values(contexts).map((c) => c.close()))
  }
  return out
}

function expectAllClose(values: Geometry[], pick: (g: Geometry) => number, what: string) {
  const reference = pick(values[0])
  for (const g of values) {
    expect(
      Math.abs(pick(g) - reference),
      `${what}: ${g.path} = ${pick(g)}, ${values[0].path} = ${reference}`
    ).toBeLessThanOrEqual(TOL)
  }
}

test("канон шапки: H1 одного размера и на одной координате @smoke", async ({ browser }) => {
  const plain = await collect(browser, WITHOUT_CRUMB)
  const crumbed = await collect(browser, WITH_CRUMB)
  const all = [...plain, ...crumbed]

  // Размер H1 один на весь кабинет — пропа size у PageHeader больше нет.
  expectAllClose(all, (g) => g.fontSize, "размер H1")
  // Ширину и поля задаёт DashboardShell, поэтому левый край общий.
  expectAllClose(all, (g) => g.left, "левая координата H1")
  // Отступ до контента живёт в компоненте, а не в className страницы.
  for (const g of all) {
    expect(g.headerPaddingBottom, `padding-bottom шапки: ${g.path}`).toBe(32)
    expect(g.headerMarginBottom, `margin-bottom шапки: ${g.path}`).toBe(0)
  }

  // Верх H1: свой внутри каждой группы.
  expectAllClose(plain, (g) => g.top, "верх H1 (экраны без крошки)")
  expectAllClose(crumbed, (g) => g.top, "верх H1 (экраны с крошкой)")

  // Крошка не «съедает» заголовок и не совпадает с ним по высоте: она стоит
  // выше H1, иначе её просто не отрисовали.
  expect(crumbed[0].top).toBeGreaterThan(plain[0].top)
})
