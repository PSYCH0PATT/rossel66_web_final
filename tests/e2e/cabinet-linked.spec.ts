/**
 * Связанные профили артиста (AKA): один кабинет на группу.
 *
 * Модель: у группы профилей общий кабинет — кабинет главного. Отдельной страницы
 * у привязанного профиля нет, его логин ведёт туда же, а данные всех профилей
 * показываются вместе с фильтром «Профиль».
 *
 * Сценарии делят состояние: первый привязывает профиль, последний отвязывает.
 */
import { expect, test } from "@playwright/test"
import { USERS, SEED_PASSWORD, getAs, loginAs, sessionHeader } from "./support/session"

const BASE = "http://127.0.0.1:3000"

test.describe.serial("связанные профили", () => {
  test.beforeAll(async ({ request }) => {
    await request.delete(`/api/artists/link?linkedArtistId=${USERS.linked.id}`, {
      headers: sessionHeader(USERS.admin),
    })
  })

  test("до привязки у профилей раздельные кабинеты", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    const response = await page.goto(`/dashboard/artist/${USERS.linked.username}/dashboard`)
    expect(response?.status()).toBe(404)
  })

  test("до привязки главный видит только свои релизы", async ({ request }) => {
    const response = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&pageSize=100`
    )
    expect(response.status()).toBe(200)
    expect((await response.json()).total).toBe(2)
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
    const response = await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.linked.id, linkedArtistId: USERS.solo.id },
    })
    expect(response.status()).toBe(400)
  })

  test("логин привязанного профиля открывает кабинет главного", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      data: { username: USERS.linked.username, password: SEED_PASSWORD },
    })
    expect(response.status(), "пароль привязанного должен остаться рабочим").toBe(200)
    const body = await response.json()
    // Сессия выдаётся от имени главного — кабинет у группы один.
    expect(body.user.username).toBe(USERS.main.username)
    expect(body.user.id).toBe(USERS.main.id)
  })

  test("страница привязанного профиля уводит в кабинет главного", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    await page.goto(`/dashboard/artist/${USERS.linked.username}/dashboard`)
    await page.waitForURL(`**/dashboard/artist/${USERS.main.username}/dashboard`)
    expect(page.url()).toContain(`/dashboard/artist/${USERS.main.username}/`)
  })

  test("посторонний артист в кабинет группы не попадает", async ({ page, context }) => {
    await loginAs(context, USERS.stranger, BASE)
    const response = await page.goto(`/dashboard/artist/${USERS.main.username}/dashboard`)
    expect(response?.status()).toBe(404)
  })

  test("кабинет показывает релизы всех профилей группы", async ({ request }) => {
    // Сид: 2 релиза у главного + 3 у привязанного.
    const all = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&pageSize=100`
    )
    expect(all.status()).toBe(200)
    expect((await all.json()).total).toBe(5)
  })

  test("фильтр «Профиль» сужает список до одного профиля", async ({ request }) => {
    const onlyMain = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&profileId=${USERS.main.id}&pageSize=100`
    )
    expect((await onlyMain.json()).total).toBe(2)

    const onlyLinked = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&profileId=${USERS.linked.id}&pageSize=100`
    )
    expect((await onlyLinked.json()).total).toBe(3)
  })

  test("чужой профиль в фильтр не пролезает", async ({ request }) => {
    // solo не в группе — подмена profileId не должна открыть его релизы.
    const response = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&profileId=${USERS.solo.id}&pageSize=100`
    )
    const total = (await response.json()).total
    expect(total, "чужой profileId игнорируется, отдаётся группа").toBe(5)
  })

  test("релизы привязанного профиля открываются из кабинета группы", async ({ request }) => {
    const list = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&profileId=${USERS.linked.id}&pageSize=100`
    )
    const release = (await list.json()).releases[0]
    expect(release, "у привязанного должен быть релиз").toBeTruthy()

    const card = await getAs(request, USERS.main, `/api/releases/${release.id}`)
    expect(card.status(), "карточка релиза привязанного профиля").toBe(200)

    const asStranger = await getAs(request, USERS.stranger, `/api/releases/${release.id}`)
    expect(asStranger.status()).toBe(403)
  })

  test("главный скачивает отчёт привязанного, посторонний — нет", async ({ request }) => {
    const reportId = "e2e-report-linked-q3"
    const asMain = await getAs(request, USERS.main, `/api/reports/preview/${reportId}`)
    expect(asMain.status(), "главный должен получить доступ").not.toBe(403)

    const asStranger = await getAs(request, USERS.stranger, `/api/reports/preview/${reportId}`)
    expect(asStranger.status()).toBe(403)
  })

  test("артист не может привязать себя к чужому профилю через PUT", async ({ request }) => {
    const response = await request.put("/api/artists", {
      headers: sessionHeader(USERS.stranger),
      data: { id: USERS.stranger.id, mainArtistId: USERS.main.id },
    })
    expect([200, 400]).toContain(response.status())

    const check = await getAs(request, USERS.admin, `/api/artists?id=${USERS.stranger.id}`)
    const body = await check.json()
    expect(body.artists?.[0]?.mainArtistId ?? null).toBeNull()
  })

  test("аналитика: агрегат группы и фильтр по профилю", async ({ request }) => {
    const totalFor = async (query: string) => {
      const response = await getAs(
        request,
        USERS.main,
        `/api/analytics/streams?startDate=2026-01-01&endDate=2026-12-31${query}`
      )
      expect(response.status()).toBe(200)
      return (await response.json()).data?.totalStreams ?? 0
    }

    // Сид: свои 1500 + привязанного 300 + коллаб 700 ОДИН раз (это один человек
    // под двумя именами) = 2500. 3200 означало бы двойной счёт.
    expect(await totalFor("")).toBe(2500)

    // Только главный: свои 1500 + коллаб 700.
    expect(await totalFor(`&profileId=${USERS.main.id}`)).toBe(2200)

    // Только привязанный: свои 300 + коллаб 700.
    expect(await totalFor(`&profileId=${USERS.linked.id}`)).toBe(1000)
  })

  test("в колонке артиста стоит владелец релиза, а не владелец кабинета", async ({ request }) => {
    // Релизы группы принадлежат разным профилям: подписывать их именем главного
    // было бы неверно — пользователь видел бы helmxnq под релизами lunstery.
    const response = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&pageSize=100`
    )
    expect(response.status()).toBe(200)
    const { releases } = await response.json()

    const linkedRelease = releases.find((r: { artistId: string }) => r.artistId === USERS.linked.id)
    expect(linkedRelease, "в группе должен быть релиз привязанного профиля").toBeTruthy()
    expect(linkedRelease.artistName).toBe("E2E Linked")

    const mainRelease = releases.find((r: { artistId: string }) => r.artistId === USERS.main.id)
    expect(mainRelease.artistName).toBe("E2E Main")
  })

  test("поиск релизов в админке находит по нику артиста", async ({ request }) => {
    // Раньше запрос смотрел только в название и UPC, и поиск по нику давал пусто.
    const byUsername = await getAs(request, USERS.admin, "/api/releases?q=e2e-linked&pageSize=100")
    expect(byUsername.status()).toBe(200)
    const found = (await byUsername.json()).releases
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((r: { artistId: string }) => r.artistId === USERS.linked.id)).toBe(true)

    // И по отображаемому имени тоже.
    const byName = await getAs(request, USERS.admin, "/api/releases?q=E2E Linked&pageSize=100")
    expect((await byName.json()).releases.length).toBeGreaterThan(0)
  })

  test("привязанный профиль исчезает из списка артистов в админке", async ({ request }) => {
    const response = await getAs(request, USERS.admin, "/api/artists?pageSize=100")
    expect(response.status()).toBe(200)
    const body = await response.json()
    const usernames = body.artists.map((a: { username: string }) => a.username)

    expect(usernames).toContain(USERS.main.username)
    expect(usernames, "привязанный профиль своей карточки больше не имеет").not.toContain(
      USERS.linked.username
    )
    // Счётчики должны совпадать со списком, иначе пагинация «дырявая».
    expect(body.total).toBe(usernames.length)
    expect(body.stats.all).toBe(body.total)
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

    const releases = await getAs(
      request,
      USERS.main,
      `/api/releases?artistId=${USERS.main.id}&pageSize=100`
    )
    expect((await releases.json()).total, "снова только свои").toBe(2)

    const admin = await getAs(request, USERS.admin, "/api/artists?pageSize=100")
    const usernames = (await admin.json()).artists.map((a: { username: string }) => a.username)
    expect(usernames, "карточка вернулась в список").toContain(USERS.linked.username)
  })
})
