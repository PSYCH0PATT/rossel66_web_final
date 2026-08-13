/**
 * Связанные профили артиста (AKA): доступ, переключатель, агрегация, безопасность.
 *
 * Сценарии идут по порядку и делят состояние: первый привязывает профиль,
 * последний отвязывает. Поэтому serial.
 */
import { expect, test } from "@playwright/test"
import { USERS, getAs, loginAs, sessionHeader } from "./support/session"

const BASE = "http://127.0.0.1:3000"

test.describe.serial("связанные профили", () => {
  test.beforeAll(async ({ request }) => {
    // На всякий случай снимаем привязку, оставшуюся от прошлого прогона.
    await request.delete(`/api/artists/link?linkedArtistId=${USERS.linked.id}`, {
      headers: sessionHeader(USERS.admin),
    })
  })

  test("до привязки главный в чужой кабинет не попадает", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    const response = await page.goto(`/dashboard/artist/${USERS.linked.username}/dashboard`)
    expect(response?.status()).toBe(404)
  })

  test("привязка доступна только админу", async ({ request }) => {
    const asArtist = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.main),
      data: { mainArtistId: USERS.main.id, linkedArtistId: USERS.linked.id },
    })
    expect(asArtist.status()).toBe(403)

    const anonymous = await request.post("/api/artists/link", {
      data: { mainArtistId: USERS.main.id, linkedArtistId: USERS.linked.id },
    })
    expect(anonymous.status()).toBe(401)
  })

  test("нельзя привязать профиль к самому себе", async ({ request }) => {
    const response = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.main.id, linkedArtistId: USERS.main.id },
    })
    expect(response.status()).toBe(400)
  })

  test("админ привязывает профиль", async ({ request }) => {
    const response = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.main.id, linkedArtistId: USERS.linked.id },
    })
    expect(response.status()).toBe(200)
  })

  test("второй уровень вложенности запрещён", async ({ request }) => {
    // e2e-solo → e2e-linked, а у linked уже есть главный.
    const response = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.linked.id, linkedArtistId: USERS.solo.id },
    })
    expect(response.status()).toBe(400)
  })

  test("главный открывает страницы привязанного профиля", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    for (const section of ["dashboard", "reports", "payments", "releases"]) {
      const response = await page.goto(`/dashboard/artist/${USERS.linked.username}/${section}`)
      expect(response?.status(), `раздел ${section}`).toBe(200)
    }
  })

  test("привязанный в кабинет главного не попадает, связь односторонняя", async ({
    page,
    context,
  }) => {
    await loginAs(context, USERS.linked, BASE)
    const response = await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
    expect(response?.status()).toBe(404)
  })

  test("посторонний артист не видит ни один из профилей группы", async ({ page, context }) => {
    await loginAs(context, USERS.stranger, BASE)
    for (const username of [USERS.main.username, USERS.linked.username]) {
      const response = await page.goto(`/dashboard/artist/${username}/dashboard`)
      expect(response?.status(), `кабинет ${username}`).toBe(404)
    }
  })

  test("переключатель профилей виден только главному", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
    const switcher = page.locator("#profile-switcher")
    await expect(switcher).toBeVisible()
    await expect(switcher.locator("option")).toHaveCount(2)

    await loginAs(context, USERS.solo, BASE)
    await page.goto(`/dashboard/artist/${USERS.solo.username}/dashboard`)
    await expect(page.locator("#profile-switcher")).toHaveCount(0)
  })

  test("переключатель уводит на тот же раздел другого профиля", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    await page.goto(`/dashboard/artist/${USERS.main.username}/payments`)
    await page.selectOption("#profile-switcher", USERS.linked.username)
    await page.waitForURL(`**/dashboard/artist/${USERS.linked.username}/payments`)
    expect(page.url()).toContain(`/dashboard/artist/${USERS.linked.username}/payments`)
  })

  test("главный скачивает отчёт привязанного, посторонний — нет", async ({ request }) => {
    const reportId = "e2e-report-linked-q3"

    const asMain = await getAs(request, USERS.main, `/api/reports/preview/${reportId}`)
    expect(asMain.status(), "главный должен получить доступ").not.toBe(403)

    const asStranger = await getAs(request, USERS.stranger, `/api/reports/preview/${reportId}`)
    expect(asStranger.status()).toBe(403)
  })

  test("артист не может привязать себя к чужому профилю через PUT", async ({ request }) => {
    // Регрессия: mainArtistId намеренно не входит в схему artistPutSchema —
    // иначе артист получил бы доступ в чужой кабинет одним запросом.
    const response = await request.put("/api/artists", {
      headers: sessionHeader(USERS.stranger),
      data: { id: USERS.stranger.id, mainArtistId: USERS.main.id },
    })
    expect([200, 400]).toContain(response.status())

    const check = await getAs(request, USERS.admin, `/api/artists?id=${USERS.stranger.id}`)
    const body = await check.json()
    expect(body.artists?.[0]?.mainArtistId ?? null).toBeNull()
  })

  test("аналитика главного включает стримы привязанного, коллаб считается один раз", async ({
    request,
  }) => {
    const totalFor = async (user: (typeof USERS)[keyof typeof USERS]) => {
      const response = await getAs(
        request,
        user,
        "/api/analytics/streams?startDate=2026-01-01&endDate=2026-12-31"
      )
      expect(response.status(), `аналитика для ${user.username}`).toBe(200)
      const body = await response.json()
      return body.data?.totalStreams ?? 0
    }

    // Сид: свои 1500 + привязанного 300 + коллаб 700 = 2500.
    // Коллаб «E2E Main & E2E Linked» — один человек под двумя именами, поэтому
    // 3200 здесь означало бы двойной счёт.
    expect(await totalFor(USERS.main)).toBe(2500)

    // Кабинет привязанного показывает только его: 300 своих + 700 коллаба.
    expect(await totalFor(USERS.linked)).toBe(1000)

    // Посторонний чужих стримов не видит.
    expect(await totalFor(USERS.stranger)).toBe(0)
  })

  test("отвязка возвращает всё к исходному состоянию", async ({ page, context, request }) => {
    const response = await request.delete(
      `/api/artists/link?linkedArtistId=${USERS.linked.id}`,
      { headers: sessionHeader(USERS.admin) }
    )
    expect(response.status()).toBe(200)

    await loginAs(context, USERS.main, BASE)
    const afterUnlink = await page.goto(`/dashboard/artist/${USERS.linked.username}/dashboard`)
    expect(afterUnlink?.status()).toBe(404)

    await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
    await expect(page.locator("#profile-switcher")).toHaveCount(0)
  })
})
