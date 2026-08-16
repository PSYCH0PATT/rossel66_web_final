/**
 * Сквозной прогон генератора отчётов: выписка XLSX → питон → отчёты в базе.
 *
 * Это единственный тест, который проходит весь путь целиком: HTTP-роут, экспорт
 * данных из БД, питон-обработчик, загрузка файла в Storage (стаб) и запись строк
 * Report. Здесь проверяется главное обещание связанных профилей — квартальный
 * отчёт у группы один.
 */
import { expect, test } from "@playwright/test"
import ExcelJS from "exceljs"
import { existsSync, readFileSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { USERS, getAs, sessionHeader } from "./support/session"

const QUARTER = "Q3"
const YEAR = 2026

/** Строит выписку XLSX тем же ExcelJS, которым её потом читает генератор. */
async function buildStatement(path: string) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("TDSheet")
  sheet.addRow(["Код", "Исполнитель", "Наименование", "Альбом", "Количество", "Сумма, руб."])
  sheet.addRow(["E2E-ISRC-1", "E2E Main", "Трек главного", "Альбом", 100, 1000.0])
  sheet.addRow(["E2E-ISRC-2", "E2E Linked", "Трек привязанного", "Альбом", 40, 400.0])
  sheet.addRow(["E2E-ISRC-3", "E2E Solo", "Трек солиста", "Альбом", 20, 200.0])
  sheet.addRow(["E2E-ISRC-4", "Никому Не Известный", "Ничей трек", "Альбом", 5, 55.0])
  await workbook.xlsx.writeFile(path)
}

test.describe.serial("генератор отчётов", () => {
  const statementPath = join(tmpdir(), `e2e-statement-${Date.now()}.xlsx`)

  test.beforeAll(async ({ request }) => {
    await buildStatement(statementPath)
    // Профили должны быть связаны — это и проверяем.
    await request.post("/api/artists/link", {
      headers: sessionHeader(USERS.admin),
      data: { mainArtistId: USERS.main.id, linkedArtistId: USERS.linked.id },
    })
  })

  test.afterAll(async ({ request }) => {
    rmSync(statementPath, { force: true })
    await request.delete(`/api/artists/link?linkedArtistId=${USERS.linked.id}`, {
      headers: sessionHeader(USERS.admin),
    })
  })

  test("группа связанных профилей получает один отчёт, чужие деньги не теряются", async ({
    request,
  }) => {
    const response = await request.post("/api/reports/process-python", {
      headers: sessionHeader(USERS.admin),
      multipart: {
        file: {
          name: "statement.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: readFileSync(statementPath),
        },
        quarter: QUARTER,
        year: String(YEAR),
      },
      timeout: 120_000,
    })

    expect(response.status(), await response.text()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    const names: string[] = (body.reports ?? []).map((r: { artistName: string }) => r.artistName)

    // Главный получил один отчёт, привязанный — отдельного не получил.
    expect(names).toContain("E2E Main")
    expect(names).not.toContain("E2E Linked")
    expect(names.filter((n) => n === "E2E Main")).toHaveLength(1)

    // 1000 (главный) + 400 (привязанный) слиты в один отчёт.
    const merged = body.reports.find((r: { artistName: string }) => r.artistName === "E2E Main")
    expect(merged.totalAmount).toBeCloseTo(1400, 2)
    expect(merged.totalPlays).toBe(140)

    // Отдельный артист остался сам по себе.
    const solo = body.reports.find((r: { artistName: string }) => r.artistName === "E2E Solo")
    expect(solo.totalAmount).toBeCloseTo(200, 2)

    // Деньги неизвестного исполнителя не исчезли молча — они в ответе.
    const unmatched = body.unmatchedArtists ?? []
    const outsider = unmatched.find(
      (u: { trackArtist: string }) => u.trackArtist === "Никому Не Известный"
    )
    expect(outsider, "нераспознанный исполнитель должен вернуться в ответе").toBeTruthy()
    expect(outsider.totalAmount).toBeCloseTo(55, 2)
    expect(outsider.rows).toBe(1)
  })

  test("старый отчёт привязанного профиля за тот же квартал погашен", async ({ request }) => {
    // В сиде у e2e-linked есть отчёт за Q3 2026 на 800. После merged-прогона он
    // не должен оставаться действующим, иначе деньги посчитаются дважды.
    const response = await getAs(
      request,
      USERS.admin,
      `/api/reports/list/${QUARTER}?year=${YEAR}&pageSize=100`
    )
    expect(response.status()).toBe(200)
    const { reports } = await response.json()
    const names = reports.map((r: { artistName: string }) => r.artistName)

    expect(names).toContain("E2E Main")
    expect(names).not.toContain("E2E Linked")
  })

  test("файл отчёта можно скачать", async ({ request }) => {
    const list = await getAs(
      request,
      USERS.admin,
      `/api/reports/list/${QUARTER}?year=${YEAR}&pageSize=100`
    )
    const { reports } = await list.json()
    const merged = reports.find((r: { artistName: string }) => r.artistName === "E2E Main")
    expect(merged, "отчёт главного должен быть в списке").toBeTruthy()

    const download = await getAs(request, USERS.admin, `/api/reports/download/${merged.id}`)
    expect(download.status()).toBe(200)
    const bytes = await download.body()
    // xlsx — это zip, сигнатура PK
    expect(bytes.subarray(0, 2).toString()).toBe("PK")
  })

  test("главный видит merged-отчёт в своём кабинете", async ({ request }) => {
    const response = await getAs(
      request,
      USERS.main,
      `/api/reports/list/${QUARTER}?year=${YEAR}&pageSize=100`
    )
    expect(response.status()).toBe(200)
    const { reports } = await response.json()
    expect(reports.map((r: { artistName: string }) => r.artistName)).toContain("E2E Main")
  })
})
