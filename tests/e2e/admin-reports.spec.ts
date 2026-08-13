/**
 * Админские отчёты: очередь на подпись, фильтры и сортировка.
 *
 * Сид кладёт 25 отчётов Q4 2026 со статусом «ознакомлен, не подписан» — больше
 * страницы в 20, чтобы проверить пагинацию и стабильность порядка. Суммы идут
 * по 100, 200, … 2500, даты ознакомления различаются.
 */
import { expect, test } from "@playwright/test"
import { USERS, getAs, loginAs, sessionHeader } from "./support/session"

const BASE = "http://127.0.0.1:3000"
const SEEDED_QUEUE = 25

type QueueResponse = {
  reports: { id: string; artistName: string; totalAmount: number; acknowledgedAt: string | null }[]
  total: number
}

async function queue(
  request: import("@playwright/test").APIRequestContext,
  query = ""
): Promise<QueueResponse> {
  const response = await getAs(request, USERS.admin, `/api/reports/attention${query}`)
  expect(response.status(), `очередь${query}`).toBe(200)
  return response.json()
}

test.describe.serial("очередь на подпись", () => {
  test("закрыта для всех, кроме админа", async ({ request }) => {
    expect((await getAs(request, USERS.main, "/api/reports/attention")).status()).toBe(403)
    expect((await request.get("/api/reports/attention")).status()).toBe(401)
  })

  test("собирает ознакомленные, но не подписанные отчёты", async ({ request }) => {
    const data = await queue(request)
    expect(data.total).toBe(SEEDED_QUEUE)
    expect(data.reports.length).toBe(20)
  })

  test("по умолчанию сверху те, кто ждёт дольше всех", async ({ request }) => {
    const data = await queue(request)
    const dates = data.reports.map((r) => r.acknowledgedAt).filter(Boolean) as string[]
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })

  test("сортирует по сумме в обе стороны", async ({ request }) => {
    const asc = await queue(request, "?sort=totalAmount&dir=asc")
    const amounts = asc.reports.map((r) => r.totalAmount)
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b))
    expect(amounts[0]).toBe(100)

    const desc = await queue(request, "?sort=totalAmount&dir=desc")
    const descAmounts = desc.reports.map((r) => r.totalAmount)
    expect(descAmounts).toEqual([...descAmounts].sort((a, b) => b - a))
    expect(descAmounts[0]).toBe(2500)
  })

  test("сортирует по имени артиста", async ({ request }) => {
    const data = await queue(request, "?sort=artistName&dir=asc")
    const names = data.reports.map((r) => r.artistName)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  test("мусор в параметре сортировки не роняет роут и не уходит в SQL", async ({ request }) => {
    const injection = encodeURIComponent(`artistName"; DROP TABLE "Report"; --`)
    const data = await queue(request, `?sort=${injection}&dir=asc`)
    expect(data.total).toBe(SEEDED_QUEUE)

    // Таблица на месте — инъекция не сработала.
    const check = await queue(request)
    expect(check.total).toBe(SEEDED_QUEUE)
  })

  test("страницы не пересекаются — порядок стабилен", async ({ request }) => {
    const first = await queue(request, "?sort=totalAmount&dir=desc&page=1&pageSize=20")
    const second = await queue(request, "?sort=totalAmount&dir=desc&page=2&pageSize=20")
    expect(first.reports).toHaveLength(20)
    expect(second.reports).toHaveLength(5)

    const ids = new Set([...first.reports, ...second.reports].map((r) => r.id))
    expect(ids.size).toBe(SEEDED_QUEUE)
  })

  test("подписанный отчёт покидает очередь", async ({ request }) => {
    const before = await queue(request)
    const target = before.reports[0]

    const update = await request.put("/api/reports/update-status", {
      headers: sessionHeader(USERS.admin),
      data: { reportId: target.id, statusType: "signed", value: true },
    })
    expect(update.status()).toBe(200)

    const after = await queue(request)
    expect(after.total).toBe(SEEDED_QUEUE - 1)
    expect(after.reports.map((r) => r.id)).not.toContain(target.id)

    // Возвращаем как было, чтобы сюит можно было прогнать повторно.
    await request.put("/api/reports/update-status", {
      headers: sessionHeader(USERS.admin),
      data: { reportId: target.id, statusType: "signed", value: false },
    })
    expect((await queue(request)).total).toBe(SEEDED_QUEUE)
  })

  test("вкладка «Ждут подписи» показывает очередь админу", async ({ page, context }) => {
    await loginAs(context, USERS.admin, BASE)
    await page.goto("/dashboard/admin/reports")
    await page.getByRole("tab", { name: /Ждут подписи/i }).click()
    await expect(page.getByRole("heading", { name: "Ждут подписи" })).toBeVisible()
    await expect(page.getByText(`${SEEDED_QUEUE} отчётов ознакомлены`)).toBeVisible()
  })
})

test.describe("фильтр и сортировка квартального списка", () => {
  test("фильтр «ознакомлен, не подписан» отдаёт только их", async ({ request }) => {
    const response = await getAs(
      request,
      USERS.admin,
      "/api/reports/list/Q4?year=2026&filter=acknowledged_unsigned&pageSize=100"
    )
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data.total).toBe(SEEDED_QUEUE)
    for (const report of data.reports) {
      expect(report.isAcknowledged).toBe(true)
      expect(report.isSigned).toBeFalsy()
    }
  })

  test("сортировка квартального списка работает по любому разрешённому полю", async ({
    request,
  }) => {
    for (const field of ["totalAmount", "totalPlays", "artistName", "uploadedAt"]) {
      const response = await getAs(
        request,
        USERS.admin,
        `/api/reports/list/Q4?year=2026&sort=${field}&dir=asc&pageSize=100`
      )
      expect(response.status(), `сортировка по ${field}`).toBe(200)
      expect((await response.json()).reports.length).toBeGreaterThan(0)
    }
  })

  test("артист не видит чужие отчёты в списке квартала", async ({ request }) => {
    const response = await getAs(request, USERS.stranger, "/api/reports/list/Q1?year=2026")
    expect(response.status()).toBe(200)
    expect((await response.json()).reports).toHaveLength(0)
  })
})
