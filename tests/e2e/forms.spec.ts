import { test, expect, type Locator, type Page } from "@playwright/test"
import path from "path"
import {
  assertBuildinSubmissionExists,
  assertLiveFormSchema,
  drainOutbox,
  e2eRunId,
  fixturesDir,
  isE2eVerifyBuildinEnabled,
  waitForSessionCompleted,
} from "./helpers"

const runId = e2eRunId()
const cover = path.join(fixturesDir, "cover.png")
const audio = path.join(fixturesDir, "audio.wav")

async function selectByLabel(
  page: Page,
  form: Locator,
  label: RegExp,
  option: string | RegExp
) {
  const group = form.locator("label").filter({ hasText: label }).locator("xpath=..")
  const trigger = group.locator('button[role="combobox"]').first()
  await expect(trigger).toBeVisible({ timeout: 15_000 })
  await trigger.click()
  await page.getByRole("option", { name: option }).click()
}

async function fillName(form: Locator, name: string, value: string) {
  const input = form.locator(`[name="${name}"]:visible`).first()
  await expect(input).toBeVisible({ timeout: 15_000 })
  await input.fill(value)
}

/** Radix selects inside track tables often have no accessible name. */
async function selectTrackLanguage(page: Page, form: Locator) {
  const row = form.locator("table tbody tr").first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  const langHeader = form.locator("table thead th", { hasText: /язык/i })
  const headerIndex = await langHeader.first().evaluate((el) => {
    const ths = Array.from(el.parentElement?.children || [])
    return ths.indexOf(el)
  })
  const cell =
    headerIndex >= 0 ? row.locator("td").nth(headerIndex) : row
  await cell.getByRole("combobox").first().click()
  await page.getByRole("option", { name: /^Без слов$/i }).click()
}

async function selectTrackExplicitNo(page: Page, form: Locator) {
  const row = form.locator("table tbody tr").first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  const explicitHeader = form.locator("table thead th", { hasText: /мат/i })
  if ((await explicitHeader.count()) > 0) {
    const headerIndex = await explicitHeader.first().evaluate((el) => {
      const ths = Array.from(el.parentElement?.children || [])
      return ths.indexOf(el)
    })
    if (headerIndex >= 0) {
      const cell = row.locator("td").nth(headerIndex)
      const box = cell.getByRole("combobox")
      if ((await box.count()) > 0) {
        await box.first().click()
        await page.getByRole("option", { name: /^Нет$/i }).click()
        return
      }
    }
  }
  // Checkbox path (catalog)
  const checkbox = row.locator('input[type="checkbox"]').first()
  if ((await checkbox.count()) > 0) {
    if (await checkbox.isChecked()) await checkbox.uncheck()
    return
  }
  // Fallback: second combobox in row
  const boxes = row.getByRole("combobox")
  await expect(boxes.nth(1)).toBeVisible({ timeout: 10_000 })
  await boxes.nth(1).click()
  await page.getByRole("option", { name: /^Нет$/i }).click()
}

async function attachCoverAndAudio(form: Locator) {
  const candidates = form.locator('input[type="file"]')
  await expect(candidates.first()).toBeAttached({ timeout: 15_000 })
  const count = await candidates.count()
  let coverIdx = -1
  let audioIdx = -1
  for (let i = 0; i < count; i++) {
    const accept = (await candidates.nth(i).getAttribute("accept")) || ""
    if (coverIdx < 0 && /image|jpeg|png/i.test(accept)) coverIdx = i
    if (audioIdx < 0 && (/wav|audio/i.test(accept) || accept.includes(".wav")))
      audioIdx = i
  }
  expect(coverIdx, "cover file input not found").toBeGreaterThanOrEqual(0)
  expect(audioIdx, "audio file input not found").toBeGreaterThanOrEqual(0)
  await candidates.nth(coverIdx).setInputFiles(cover)
  await candidates.nth(audioIdx).setInputFiles(audio)
}

type SessionCapture = { sessionId: string; accessToken: string }

async function captureSessionCreate(page: Page): Promise<{
  get: () => SessionCapture | null
}> {
  let captured: SessionCapture | null = null
  await page.route("**/api/forms/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const json = (await response.json().catch(() => ({}))) as {
      sessionId?: string
      accessToken?: string
    }
    if (json.sessionId && json.accessToken) {
      captured = {
        sessionId: String(json.sessionId),
        accessToken: String(json.accessToken),
      }
    }
    await route.fulfill({ response })
  })
  return {
    get: () => captured,
  }
}

async function expectUiSuccess(page: Page, timeout = 180_000) {
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout }
  )
}

async function expectSessionCompleted(page: Page, capture: { get: () => SessionCapture | null }) {
  const session = capture.get()
  expect(session, "session create response not captured").toBeTruthy()
  if (!session) return
  await waitForSessionCompleted(page.url(), session.sessionId, session.accessToken)
}

test.describe.serial("forms e2e", () => {
  test("contact form full submit", async ({ page }) => {
    const nick = `E2E Contact ${runId}`
    await page.goto("/")
    const form = page.getByTestId("contact-form")
    await expect(form).toBeVisible({ timeout: 30_000 })
    await form.getByLabel(/ник|nickname|имя/i).first().fill(nick)
    await form.locator("#telegram, [name=telegram]").first().fill(`@e2e_${runId.slice(-6)}`)
    await form.locator("#about, [name=about], textarea").first().fill(`about ${runId}`)
    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page, 60_000)
    await drainOutbox(page.url())
    await assertBuildinSubmissionExists({
      titleNeedle: nick,
      expectStatus: null,
    })
  })

  test("data RF full submit", async ({ page }) => {
    await page.goto("/forms/dataRF")
    const form = page.getByTestId("data-rf-form")
    await expect(form).toBeVisible()

    await fillName(form, "nickname", `E2E RF ${runId}`)
    await fillName(form, "telegramProfile", `@rf_${runId.slice(-6)}`)
    await fillName(form, "email", `test+rf.${runId}@rossel.invalid`)
    await fillName(form, "passportFullName", "Иванов Иван Иванович")
    await fillName(form, "passportShortName", "Иванов И.И.")
    await fillName(form, "dateOfBirth", "1990-01-15")
    await fillName(form, "passportSeriesNumber", "1234 567890")
    await fillName(form, "passportIssuedBy", "ОВД Тестовый")
    await fillName(form, "passportIssueDate", "2010-05-20")
    await fillName(form, "passportDepartmentCode", "123-456")
    await fillName(form, "placeOfBirth", "г. Москва")
    await fillName(form, "registrationAddress", "г. Москва, ул. Тестовая, д. 1")
    await fillName(form, "snils", "123-456-789 00")
    await fillName(form, "inn", "7707083893")
    await fillName(form, "bankName", "Тест Банк")
    await fillName(form, "bankAccountNumber", "40817810099910004312")
    await fillName(form, "bankCorrespondentAccount", "30101810400000000225")
    await fillName(form, "bankBik", "044525225")
    await fillName(form, "bankInn", "7707083893")
    await fillName(form, "bankKpp", "773601001")

    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page, 60_000)
    await drainOutbox(page.url())
    await assertBuildinSubmissionExists({
      titleNeedle: `E2E RF ${runId}`,
      expectStatus: null,
    })
  })

  test("data not RF full submit", async ({ page }) => {
    await page.goto("/forms/dataNotRF")
    const form = page.getByTestId("data-not-rf-form")
    await expect(form).toBeVisible()

    await fillName(form, "nickname", `E2E NotRF ${runId}`)
    await fillName(form, "telegramProfile", `@nr_${runId.slice(-6)}`)
    await fillName(form, "email", `test+notrf.${runId}@rossel.invalid`)
    await fillName(form, "passportFullName", "John Test Doe")
    await fillName(form, "passportShortName", "Doe J. T.")
    await fillName(form, "dateOfBirth", "1990-01-15")
    await fillName(form, "passportIdNumber", "P1234567")
    await fillName(form, "placeOfBirth", "Test City")
    await fillName(form, "registrationAddress", "1 Test Street, Test City")
    await fillName(form, "taxId", "TAX-001")
    await fillName(form, "bankName", "Test Bank Intl")
    await fillName(form, "bankAccountNumber", "GB29NWBK60161331926819")

    const cit = form.getByRole("combobox", { name: /гражданство/i })
    await expect(cit).toBeVisible({ timeout: 15_000 })
    await cit.click()
    await page.getByRole("option").nth(1).click()

    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page, 90_000)
    await drainOutbox(page.url())
    await assertBuildinSubmissionExists({
      titleNeedle: `E2E NotRF ${runId}`,
      expectStatus: null,
    })
  })

  test("live form queue schemas match contracts", async () => {
    test.skip(!isE2eVerifyBuildinEnabled(), "E2E_VERIFY_BUILDIN disabled")
    await assertLiveFormSchema("catalog_upload")
    await assertLiveFormSchema("release_upload")
    await assertLiveFormSchema("distribution")
  })

  test("catalog upload with files (multi-release)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const capture = await captureSessionCreate(page)
    await page.goto("/forms/catalogUPLOAD")
    const form = page.getByTestId("catalog-upload-form")
    await expect(form).toBeVisible({ timeout: 30_000 })

    // Release 1 — album with ISRC + UPC
    await selectByLabel(page, form, /тип релиза/i, /^Альбом$/i)
    await form.getByLabel(/название релиза/i).fill(`E2E Cat ${runId}`)
    await form.getByLabel(/никнеймы артистов релиза/i).fill("E2E Artist")
    const upc = form.getByLabel(/upc|ean/i)
    if ((await upc.count()) > 0) {
      await upc.first().fill("0602438598539")
    }
    await form.getByLabel(/оригинальная дата релиза/i).fill("2024-06-01")
    await form.getByLabel(/^жанр/i).fill("Hip-hop")

    await expect(form.locator('table input[name="trackName"]').first()).toBeVisible({
      timeout: 15_000,
    })
    await form.locator('table input[name="trackName"]').first().fill("E2E Track")
    await form.locator('table input[name="mainArtists"]').first().fill("E2E Artist")
    await form.locator('table input[name="isrc"]').first().fill("USRC17607839")
    await form.locator('table input[name="previewStart"]').first().fill("00:10")
    await form.locator('table input[name="musicAuthor"]').first().fill("Composer Test")
    await selectTrackLanguage(page, form)
    await attachCoverAndAudio(form)

    // Add second release if UI supports it
    const addRelease = form.getByRole("button", { name: /добавить релиз/i })
    if ((await addRelease.count()) > 0) {
      await addRelease.first().click()
      const releaseCards = form.locator("[data-release-index], .release-card, section").filter({
        has: form.page().getByLabel(/название релиза/i),
      })
      // Fill second release title via last visible title field
      const titles = form.getByLabel(/название релиза/i)
      if ((await titles.count()) >= 2) {
        await titles.nth(1).fill(`E2E Cat B ${runId}`)
        const artists = form.getByLabel(/никнеймы артистов релиза/i)
        if ((await artists.count()) >= 2) {
          await artists.nth(1).fill("E2E Artist B")
        }
      }
      void releaseCards
    }

    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page)
    await expectSessionCompleted(page, capture)
    await drainOutbox(page.url())
    const result = await assertBuildinSubmissionExists({
      titleNeedle: "E2E Artist",
      formType: "catalog_upload",
      bodyNeedles: ["USRC17607839", "E2E Track", "Composer Test"],
      propertyNeedles: {
        "Название релиза": `E2E Cat`,
      },
      forbiddenPropertyNeedles: ["Email", "Telegram", "UPC", "Статус", "Артисты"],
      expectProcessed: false,
      minFileBlocks: 2,
    })
    if (result && isE2eVerifyBuildinEnabled()) {
      console.log(
        `[e2e-report] catalog_upload page=${result.pageId} status=${result.status} files=${result.fileBlockCount} props=${JSON.stringify(result.properties)}`
      )
    }
  })

  test("release upload with files (promo yes)", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const capture = await captureSessionCreate(page)
    await page.goto("/forms/releaseUPLOAD")
    const form = page.getByTestId("release-upload-form")
    await expect(form).toBeVisible()

    await fillName(form, "artistNicknames", `E2E Rel ${runId}`)
    await fillName(form, "releaseTitle", `E2E Release ${runId}`)
    await selectByLabel(page, form, /тип релиза/i, /Сингл \(1 трек\)/i)
    await fillName(form, "releaseDate", "2026-08-15")
    await selectByLabel(page, form, /^жанр/i, /Hip Hop\/Rap/i)

    await form.locator('table input[name="trackName"]').first().fill("Track One")
    await form.locator('table input[name="mainArtists"]').first().fill("E2E Artist")
    await form.locator('table input[name="previewStart"]').first().fill("00:15")
    await form.locator('table input[name="musicAuthor"]').first().fill("Composer")
    await selectTrackLanguage(page, form)
    await selectTrackExplicitNo(page, form)

    // Promo YES path
    await selectByLabel(page, form, /подавать релиз на промо/i, /^Да$/i)
    await fillName(form, "artistInfo", `Artist bio ${runId}`)
    await fillName(form, "releaseInfo", `Release info ${runId}`)

    await selectByLabel(page, form, /видео-сниппет/i, /^Нет$/i)
    await selectByLabel(page, form, /соц\. сети/i, /^Нет$/i)
    await selectByLabel(page, form, /стриминговых площадках/i, /^Нет$/i)

    await attachCoverAndAudio(form)

    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page)
    await expectSessionCompleted(page, capture)
    await drainOutbox(page.url())
    const result = await assertBuildinSubmissionExists({
      titleNeedle: `E2E Rel ${runId}`,
      formType: "release_upload",
      bodyNeedles: [
        "Hip Hop/Rap",
        "Track One",
        `Artist bio ${runId}`,
        `Release info ${runId}`,
      ],
      propertyNeedles: {
        "Название релиза": `E2E Release ${runId}`,
      },
      forbiddenPropertyNeedles: ["Email", "Telegram", "Контакт", "Статус", "Промо"],
      expectProcessed: false,
      minFileBlocks: 2,
    })
    if (result && isE2eVerifyBuildinEnabled()) {
      console.log(
        `[e2e-report] release_upload page=${result.pageId} status=${result.status} files=${result.fileBlockCount} props=${JSON.stringify(result.properties)}`
      )
    }
  })

  test("distribution form with files", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    const capture = await captureSessionCreate(page)
    await page.goto("/distribution")
    const form = page.getByTestId("distribution-form")
    await expect(form).toBeVisible()

    const contact = `@dist_${runId.slice(-6)}`
    await fillName(form, "artists", `E2E Dist Artist ${runId}`)
    await fillName(form, "title", `E2E Dist ${runId}`)
    await selectByLabel(page, form, /тип релиза/i, /Сингл \(1 трек\)/i)
    await fillName(form, "releaseDate", "2026-08-20")
    await selectByLabel(page, form, /^жанр/i, /Hip Hop\/Rap/i)
    await fillName(form, "contact", contact)

    await form.locator('table input[name="trackName"]').first().fill("Dist Track")
    await form.locator('table input[name="mainArtists"]').first().fill("E2E Dist Artist")
    await form.locator('table input[name="previewStart"]').first().fill("00:12")
    await form.locator('table input[name="musicAuthor"]').first().fill("Composer Dist")
    await selectTrackLanguage(page, form)
    await selectTrackExplicitNo(page, form)

    await selectByLabel(page, form, /видео-сниппет/i, /^Нет$/i)
    await selectByLabel(page, form, /подавать релиз на промо/i, /^Нет$/i)
    await selectByLabel(page, form, /стриминговых площадках/i, /^Нет$/i)

    await attachCoverAndAudio(form)

    await form.getByTestId("form-submit").click()
    await expectUiSuccess(page)
    await expectSessionCompleted(page, capture)
    await drainOutbox(page.url())
    const result = await assertBuildinSubmissionExists({
      titleNeedle: `E2E Dist Artist ${runId}`,
      formType: "distribution",
      bodyNeedles: ["Dist Track", contact, "Hip Hop/Rap"],
      propertyNeedles: {
        "Название релиза": `E2E Dist ${runId}`,
      },
      forbiddenPropertyNeedles: ["Email", "Telegram", "Контакт", "Статус", "Промо"],
      expectProcessed: false,
      minFileBlocks: 2,
    })
    if (result && isE2eVerifyBuildinEnabled()) {
      console.log(
        `[e2e-report] distribution page=${result.pageId} status=${result.status} files=${result.fileBlockCount} props=${JSON.stringify(result.properties)}`
      )
    }
  })
})
