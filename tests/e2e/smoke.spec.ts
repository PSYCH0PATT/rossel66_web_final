/**
 * @smoke — минимальный дымовой прогон: логины и то, что ключевые экраны
 * админки и кабинета артиста открываются и показывают ожидаемое.
 *
 * Логин — через реальную форму (а не cookie-инъекцию из support/session.ts),
 * это единственное место в сюите, где он проверяется по-честному. Именно
 * поэтому логинов здесь ровно два: лимит — 10 попыток на IP в минуту
 * (см. комментарий в support/session.ts), а @smoke гоняется часто.
 */
import { expect, test } from "@playwright/test"
import { USERS, SEED_PASSWORD, loginAs } from "./support/session"

const BASE = "http://127.0.0.1:3000"

async function loginViaForm(page: import("@playwright/test").Page, username: string) {
  await page.goto("/dashboard/login")
  await page.locator("#username").fill(username)
  await page.locator("#password").fill(SEED_PASSWORD)
  await page.getByRole("button", { name: "Войти" }).click()
}

test("логин админа @smoke", async ({ page }) => {
  await loginViaForm(page, USERS.admin.username)
  await page.waitForURL("**/dashboard/admin/dashboard")
  await expect(page.getByRole("heading", { name: "ГЛАВНАЯ", exact: true })).toBeVisible()
})

test("логин артиста @smoke", async ({ page }) => {
  await loginViaForm(page, USERS.main.username)
  await page.waitForURL(`**/dashboard/artist/${USERS.main.username}/dashboard`)
  await expect(page.getByRole("heading", { name: "ГЛАВНАЯ", exact: true })).toBeVisible()
})

test("/dashboard/admin/releases открывается, в таблице есть строки @smoke", async ({
  page,
  context,
}) => {
  await loginAs(context, USERS.admin, BASE)
  await page.goto("/dashboard/admin/releases")
  const rows = page.locator("table tbody tr")
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThan(0)
})

test("/dashboard/admin/analytics открывается, график отрендерён @smoke", async ({
  page,
  context,
}) => {
  await loginAs(context, USERS.admin, BASE)
  await page.goto("/dashboard/admin/analytics")
  await expect(page.getByRole("heading", { name: "АНАЛИТИКА" })).toBeVisible()

  // Сидовые данные лежат на 2026-06-15 — за пределами дефолтного окна 30 дней
  // от реальной даты прогона (B-05, docs/baseline-issues.md). 90 дней их
  // накрывают, и это тот же переключатель, которым пользуется живой админ.
  await page.getByRole("button", { name: "90Д" }).click()
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible()
})

test("/dashboard/admin/reports открывается @smoke", async ({ page, context }) => {
  await loginAs(context, USERS.admin, BASE)
  await page.goto("/dashboard/admin/reports")
  await expect(page.getByRole("heading", { name: "Отчёты", exact: true })).toBeVisible()
  // 0-а: табов у экрана больше нет — виды переключает ряд чипов, и «Выплаты»
  // теперь один из них.
  await expect(page.getByRole("button", { name: "Все", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Невыплаченные/ })).toBeVisible()
})

test("сросшиеся экраны отвечают редиректом на объединённые «Отчёты» @smoke", async ({
  page,
  context,
}) => {
  await loginAs(context, USERS.admin, BASE)
  for (const [from, view] of [
    ["/dashboard/admin/payments", "filter=unpaid"],
    ["/dashboard/admin/unregistered-reports", "tab=unregistered"],
    ["/dashboard/admin/reports-generator", "tab=generator"],
  ]) {
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`/dashboard/admin/reports\\?${view}$`))
  }
})

test("визитка артиста ведёт на его главную @smoke", async ({ page, context }) => {
  await loginAs(context, USERS.main, BASE)
  await page.goto(`/dashboard/artist/${USERS.main.username}`)
  await page.waitForURL(`**/dashboard/artist/${USERS.main.username}/dashboard`)
  await expect(page.getByRole("heading", { name: "ГЛАВНАЯ", exact: true })).toBeVisible()
})

test.fixme(
  "артист: dashboard открывается с графиком @smoke",
  // Окно графика на дашборде артиста жёстко зашито как «последние 30 дней от
  // реального now()» на сервере и не регулируется из UI (в отличие от
  // /analytics, где есть пилюли периода). Сидовые StreamAnalytics стоят датой
  // 2026-06-15 и с каждым днём прогона всё дальше выпадают из окна — сейчас
  // виджет стабильно показывает пустое состояние «Нет данных аналитики»,
  // а не график. Подробности и почему это не чинится ни правкой теста, ни
  // подбором даты «на будущее» — docs/baseline-issues.md, пункт B-05.
  async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible()
  }
)

test("артист: dashboard открывается, виджет статистики стримов присутствует @smoke", async ({
  page,
  context,
}) => {
  // Запасная проверка на тот же экран, что и test.fixme выше (см. B-05):
  // сама секция обязана открыться и не упасть, даже раз график сейчас не
  // рисуется из-за устаревшего окна дат у сидовых данных.
  await loginAs(context, USERS.main, BASE)
  await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
  await expect(page.getByRole("heading", { name: "ГЛАВНАЯ", exact: true })).toBeVisible()
  await expect(page.getByText("СТАТИСТИКА СТРИМОВ")).toBeVisible()
})
