/**
 * Регрессии на два функциональных бага из docs/ui-audit.md.
 *
 * F-01 — экран массового добавления открывался с зашитыми 22 именами, половина
 * которых уже была в базе: один клик «Добавить всех» плодил дубли.
 * F-02 — селект «Артист» на карточке релиза был пуст при реально привязанном
 * артисте, и «Сохранить» мог потерять связь.
 */
import { expect, test } from "@playwright/test"
import { USERS, loginAs, sessionHeader } from "./support/session"

const BASE = "http://127.0.0.1:3000"

test.describe("F-01 массовое добавление артистов", () => {
  test("экран открывается с пустым списком", async ({ page, context }) => {
    await loginAs(context, USERS.admin, BASE)
    await page.goto("/dashboard/admin/artists/bulk-add")

    await expect(page.getByRole("heading", { name: "Массовое добавление" })).toBeVisible()
    // Счётчик «всего N» — единственное число на экране до начала работы.
    await expect(page.getByText(/Будут добавлены следующие артисты/)).toContainText("0")
    // Ни одной строки в списке: добавлять нечего, дублей не создать.
    await expect(page.getByRole("button", { name: /^Удалить .* из списка$/ })).toHaveCount(0)
  })

  test("сервер отбивает дубль по логину", async ({ request }) => {
    const response = await request.post("/api/artists", {
      headers: sessionHeader(USERS.admin),
      data: {
        username: USERS.solo.username,
        password: "whatever1234",
        name: "Совсем другое имя",
      },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.duplicate).toBe(true)
    expect(body.duplicateReason).toBe("username")
  })

  test("сервер отбивает дубль по имени, даже если логин свободен", async ({ request }) => {
    const response = await request.post("/api/artists", {
      headers: sessionHeader(USERS.admin),
      data: {
        // Логин свободен, а имя — уже существующего артиста из сида.
        username: "e2esolo2",
        password: "e2esolo21234",
        name: "e2e solo",
      },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.duplicate).toBe(true)
    expect(body.duplicateReason).toBe("name")

    // Дубля в базе не завелось.
    const list = await request.get("/api/artists?q=e2esolo2", {
      headers: sessionHeader(USERS.admin),
    })
    expect((await list.json()).total).toBe(0)
  })
})

test.describe.serial("F-02 связь релиза с артистом", () => {
  // Артист вне выдачи списка: привязанный профиль (AKA) в /api/artists не
  // показывается вовсе — ровно тот случай, когда селект оказывался пустым.
  const artistName = "E2E F02 Hidden"
  let artistId = ""
  let releaseId = ""

  test.beforeAll(async ({ request }) => {
    const created = await request.post("/api/artists", {
      headers: sessionHeader(USERS.admin),
      data: { username: "e2ef02hidden", password: "e2ef02hidden1234", name: artistName },
    })
    expect(created.status()).toBe(200)
    artistId = (await created.json()).user.id

    const linked = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.main.id, linkedArtistId: artistId },
    })
    expect(linked.status()).toBe(200)

    const release = await request.post("/api/releases", {
      headers: sessionHeader(USERS.admin),
      data: {
        title: "E2E F02 Release",
        artistId,
        releaseDate: "2026-07-01",
        upc: "E2EF02UPC0001",
      },
    })
    expect(release.status()).toBe(200)
    releaseId = (await release.json()).release.id
  })

  test.afterAll(async ({ request }) => {
    if (releaseId) {
      await request.delete(`/api/releases/${releaseId}`, { headers: sessionHeader(USERS.admin) })
    }
    if (artistId) {
      await request.delete(`/api/artists/link?linkedArtistId=${artistId}`, {
        headers: sessionHeader(USERS.admin),
      })
      await request.delete(`/api/artists?id=${artistId}`, { headers: sessionHeader(USERS.admin) })
    }
  })

  test("селект «Артист» показывает текущую связь, а не пустоту", async ({ page, context }) => {
    await loginAs(context, USERS.admin, BASE)
    await page.goto(`/dashboard/admin/releases/${releaseId}`)

    await expect(page.getByRole("heading", { name: "E2E F02 Release" })).toBeVisible()

    const trigger = page.locator('div:text-is("Артист") + button[role="combobox"]')
    await expect(trigger).toBeVisible()
    await trigger.click()

    // Привязанный артист обязан быть в списке и быть выбранным — иначе связь
    // на экране не видна и «Сохранить» её теряет.
    const current = page.getByRole("option", { name: artistName })
    await expect(current).toBeVisible()
    await expect(current).toHaveAttribute("data-state", "checked")
    await page.keyboard.press("Escape")
  })

  test("PUT без поля artistId связь не трогает", async ({ request }) => {
    const response = await request.put(`/api/releases/${releaseId}`, {
      headers: sessionHeader(USERS.admin),
      data: { title: "E2E F02 Release" },
    })
    expect(response.status()).toBe(200)

    const after = await request.get(`/api/releases/${releaseId}`, {
      headers: sessionHeader(USERS.admin),
    })
    expect((await after.json()).release.artistId).toBe(artistId)
  })

  test("PUT с пустым artistId связь не затирает", async ({ request }) => {
    const response = await request.put(`/api/releases/${releaseId}`, {
      headers: sessionHeader(USERS.admin),
      data: { title: "E2E F02 Release", artistId: "" },
    })
    expect(response.status()).toBe(200)

    const after = await request.get(`/api/releases/${releaseId}`, {
      headers: sessionHeader(USERS.admin),
    })
    expect((await after.json()).release.artistId).toBe(artistId)
  })
})
