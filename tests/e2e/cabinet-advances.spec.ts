/**
 * Авансы: выдача админом, погашение из отчётов, что видит артист.
 *
 * Сид даёт главному два отчёта: Q1 2026 на 2000 (загружен в апреле) и Q2 2026
 * на 5000 (в июле). Аванс, выданный 1 мая, должен гаситься только вторым —
 * заработанное до выдачи артисту принадлежит.
 */
import { expect, test } from "@playwright/test"
import { USERS, getAs, loginAs, sessionHeader } from "./support/session"

const BASE = "http://127.0.0.1:3000"
// 0-а (артистская половина): деньги живут на объединённом «Отчёты и выплаты»;
// /payments остался редиректом сюда же.
const PAYMENTS = `/dashboard/artist/${USERS.main.username}/reports`

async function removeAllAdvances(request: import("@playwright/test").APIRequestContext) {
  const list = await getAs(request, USERS.admin, `/api/advances?artistId=${USERS.main.id}`)
  if (list.status() !== 200) return
  const { advances } = await list.json()
  for (const advance of advances ?? []) {
    await request.delete(`/api/advances?id=${advance.id}`, {
      headers: sessionHeader(USERS.admin),
    })
  }
}

async function createAdvance(
  request: import("@playwright/test").APIRequestContext,
  amount: number,
  issuedAt: string
) {
  return request.post("/api/advances", {
    headers: sessionHeader(USERS.admin),
    data: { artistId: USERS.main.id, amount, issuedAt },
  })
}

test.describe.serial("авансы", () => {
  test.beforeAll(async ({ request }) => {
    await removeAllAdvances(request)
  })

  test.afterAll(async ({ request }) => {
    await removeAllAdvances(request)
  })

  test("без аванса артист видит всю сумму к выплате", async ({ page, context }) => {
    await loginAs(context, USERS.main, BASE)
    await page.goto(PAYMENTS)
    // 2000 + 5000, ничего не выплачено
    await expect(page.getByTestId("total-balance")).toContainText("7 000,00")
    await expect(page.getByTestId("available-for-payout")).toContainText("7 000,00")
    await expect(page.getByTestId("advance-total")).toHaveCount(0)
  })

  test("выдавать аванс может только админ", async ({ request }) => {
    const asArtist = await request.post("/api/advances", {
      headers: sessionHeader(USERS.main),
      data: { artistId: USERS.main.id, amount: 1000, issuedAt: "2026-05-01" },
    })
    expect(asArtist.status()).toBe(403)

    const anonymous = await request.post("/api/advances", {
      data: { artistId: USERS.main.id, amount: 1000, issuedAt: "2026-05-01" },
    })
    expect(anonymous.status()).toBe(401)
  })

  test("сумма должна быть положительной", async ({ request }) => {
    const zero = await createAdvance(request, 0, "2026-05-01")
    expect(zero.status()).toBe(400)
    const negative = await createAdvance(request, -500, "2026-05-01")
    expect(negative.status()).toBe(400)
  })

  test("непогашенный аванс обнуляет доступную сумму", async ({ page, context, request }) => {
    const created = await createAdvance(request, 6000, "2026-05-01")
    expect(created.status()).toBe(200)

    await loginAs(context, USERS.main, BASE)
    await page.goto(PAYMENTS)

    // Выдано 6000, погашено 5000 (только Q2 — Q1 заработан до выдачи), осталось 1000.
    await expect(page.getByTestId("advance-total")).toContainText("6 000,00")
    await expect(page.getByTestId("advance-recouped")).toContainText("5 000,00")
    await expect(page.getByTestId("advance-remaining")).toContainText("1 000,00")
    await expect(page.getByTestId("advance-progress")).toContainText("Погашено 83%")

    // 7000 начислено − 5000 в погашение = 2000, это ниже порога 3000.
    await expect(page.getByTestId("available-for-payout")).toContainText("0,00")
    await expect(page.getByTestId("total-balance")).toContainText("7 000,00")

    // Баннер про минимум 3000 не показывается: ноль здесь по другой причине.
    await expect(page.getByText("Недостаточно средств для выплаты")).toHaveCount(0)
  })

  test("артист видит свой аванс и не видит чужой", async ({ request }) => {
    const own = await getAs(request, USERS.main, `/api/advances?artistId=${USERS.main.id}`)
    expect(own.status()).toBe(200)
    expect((await own.json()).advances).toHaveLength(1)

    const foreign = await getAs(request, USERS.stranger, `/api/advances?artistId=${USERS.main.id}`)
    expect(foreign.status()).toBe(403)
  })

  test("погашенный аванс возвращает деньги к выплате", async ({ page, context, request }) => {
    await removeAllAdvances(request)
    // 3000 гасятся целиком из Q2 (5000) → остаётся 7000 − 3000 = 4000.
    expect((await createAdvance(request, 3000, "2026-05-01")).status()).toBe(200)

    await loginAs(context, USERS.main, BASE)
    await page.goto(PAYMENTS)
    await expect(page.locator("body")).toContainText("Аванс полностью погашен")
    await expect(page.getByTestId("advance-remaining")).toContainText("0,00")
    await expect(page.getByTestId("available-for-payout")).toContainText("4 000,00")
  })

  test("аванс, выданный позже отчётов, не гасится вовсе", async ({ page, context, request }) => {
    await removeAllAdvances(request)
    // Оба отчёта загружены до 2027 года — гасить нечем.
    expect((await createAdvance(request, 4000, "2027-01-01")).status()).toBe(200)

    await loginAs(context, USERS.main, BASE)
    await page.goto(PAYMENTS)
    await expect(page.getByTestId("advance-progress")).toContainText("Погашено 0%")
    await expect(page.getByTestId("advance-recouped")).toContainText("0,00")
    await expect(page.getByTestId("advance-remaining")).toContainText("4 000,00")
  })

  test("удаление аванса возвращает страницу в исходный вид", async ({
    page,
    context,
    request,
  }) => {
    await removeAllAdvances(request)
    await loginAs(context, USERS.main, BASE)
    await page.goto(PAYMENTS)
    await expect(page.getByTestId("advance-total")).toHaveCount(0)
    await expect(page.getByTestId("available-for-payout")).toContainText("7 000,00")
  })
})
