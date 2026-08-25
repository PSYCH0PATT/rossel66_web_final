/**
 * Б-13: иконки кабинета не зависят от Google.
 *
 * Раньше `app/layout.tsx` подключал Material Symbols ссылкой на
 * fonts.googleapis.com. Нет доступа к домену — нет НИ ОДНОЙ иконки во всём
 * кабинете, а пока шрифт едет, на их месте видны слова лигатур («person»,
 * «library_music», «logout»). Аудитория проекта в России, где домен недоступен
 * регулярно, — то есть это штатное состояние, а не редкий сбой.
 *
 * Проверка честная: оба гугловских домена рубятся на уровне сети ДО загрузки
 * страницы, и только после этого мы смотрим, дошёл ли шрифт и нарисованы ли
 * иконки глифами. «Выглядит нормально» тут не считается — измеряем ширину.
 */
import { expect, test } from "@playwright/test"
import { USERS, loginAs } from "./support/session"

const BASE = "http://127.0.0.1:3000"
const GOOGLE_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"]

test("иконки рендерятся при полностью заблокированном Google @smoke", async ({
  page,
  context,
}) => {
  const blocked: string[] = []
  for (const host of GOOGLE_FONT_HOSTS) {
    await context.route(`**://${host}/**`, (route) => {
      blocked.push(route.request().url())
      return route.abort("blockedbyclient")
    })
  }

  await loginAs(context, USERS.admin, BASE)
  await page.goto("/dashboard/admin/dashboard")

  const navIcons = page.locator('nav a[href^="/dashboard/admin/"] .material-symbols-outlined')
  await expect(navIcons.first()).toBeVisible()

  // 1. К Google не ушло ни одного запроса — значит и рубить было нечего.
  expect(blocked, `запросы к Google: ${blocked.join(", ")}`).toEqual([])

  // 2. Шрифт реально доехал со своего домена. `document.fonts.check()` тут не
  //    годится: он отвечает true и на фолбэке. Спрашиваем сам FontFace.
  const fontStatus = await page.evaluate(async () => {
    // Ошибку загрузки глотаем намеренно: она должна превратиться в понятный
    // статус ниже, а не в «NetworkError» из середины теста.
    await document.fonts.load('24px "Material Symbols Outlined"').catch(() => {})
    return [...document.fonts]
      .filter((face) => face.family.includes("Material Symbols"))
      .map((face) => face.status)
  })
  expect(fontStatus, "шрифт не доехал со своего домена").toContain("loaded")

  // 3. Главное: иконки нарисованы ГЛИФАМИ, а не словами лигатур. Глиф в
  //    сайдбаре — квадрат 24px; слово «library_music» тем же кеглем занимает
  //    больше сотни пикселей, так что порог различает состояния с запасом.
  const count = await navIcons.count()
  expect(count).toBeGreaterThan(3)
  for (let i = 0; i < count; i++) {
    const icon = navIcons.nth(i)
    const name = (await icon.textContent())?.trim() ?? ""
    const box = await icon.boundingBox()
    expect(box, `иконка «${name}» не отрисована`).not.toBeNull()
    expect(
      box!.width,
      `иконка «${name}»: ширина ${box!.width}px — похоже на слово лигатуры, а не на глиф`
    ).toBeLessThan(32)
  }
})

test("лендинг не ходит к Google за шрифтом @smoke", async ({ page, context }) => {
  // Вторая половина Б-13: globals.css тянул Mulish строкой @import с
  // fonts.googleapis.com — лендинг и формы зависели от домена в рантайме.
  // Теперь шрифт забирается на сборке через next/font.
  const blocked: string[] = []
  for (const host of GOOGLE_FONT_HOSTS) {
    await context.route(`**://${host}/**`, (route) => {
      blocked.push(route.request().url())
      return route.abort("blockedbyclient")
    })
  }

  await page.goto("/", { waitUntil: "networkidle" })
  expect(blocked, `запросы к Google: ${blocked.join(", ")}`).toEqual([])

  // Шрифт действительно применён, а не подменён фолбэком: next/font кладёт
  // сгенерированное имя семейства в --font-mulish, им и пользуется разметка.
  const mulish = await page.evaluate(() => {
    // Переменные next/font висят на <body> — их кладёт className лейаута.
    const value = getComputedStyle(document.body).getPropertyValue("--font-mulish").trim()
    const loaded = [...document.fonts].some(
      (face) => value.includes(face.family.replace(/['"]/g, "")) && face.status === "loaded"
    )
    return { value, loaded }
  })
  expect(mulish.value, "переменная --font-mulish не объявлена").not.toBe("")
  expect(mulish.loaded, "Mulish не загрузился со своего домена").toBe(true)
})
