import { test, expect } from "@playwright/test"
import path from "path"
import { assertBuildinSubmissionExists, drainOutbox, e2eRunId, fixturesDir } from "./helpers"

const runId = e2eRunId()

test.describe.configure({ mode: "serial" })

test("contact form full submit", async ({ page }) => {
  const nick = `E2E Contact ${runId}`
  await page.goto("/")
  // Contact may live on landing; try dedicated section or homepage form
  const form = page.getByTestId("contact-form")
  if ((await form.count()) === 0) {
    test.skip(true, "contact-form not on /")
    return
  }
  await form.getByLabel(/ник|nickname|имя/i).first().fill(nick)
  await form.locator("#telegram, [name=telegram]").first().fill(`@e2e_${runId.slice(-6)}`)
  await form.locator("#about, [name=about], textarea").first().fill(`about ${runId}`)
  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 60_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: nick })
})

test("data RF full submit", async ({ page }) => {
  await page.goto("/forms/dataRF")
  const form = page.getByTestId("data-rf-form")
  await expect(form).toBeVisible()

  const fill = async (name: string, value: string) => {
    await form.locator(`[name="${name}"]`).fill(value)
  }

  await fill("nickname", `E2E RF ${runId}`)
  await fill("telegramProfile", `@rf_${runId.slice(-6)}`)
  await fill("email", `test+rf.${runId}@rossel.invalid`)
  await fill("passportFullName", "Иванов Иван Иванович")
  await fill("passportShortName", "Иванов И.И.")
  await fill("dateOfBirth", "1990-01-15")
  await fill("passportSeriesNumber", "1234 567890")
  await fill("passportIssuedBy", "ОВД Тестовый")
  await fill("passportIssueDate", "2010-05-20")
  await fill("passportDepartmentCode", "123-456")
  await fill("placeOfBirth", "г. Москва")
  await fill("registrationAddress", "г. Москва, ул. Тестовая, д. 1")
  await fill("snils", "123-456-789 00")
  await fill("inn", "7707083893")
  await fill("bankName", "Тест Банк")
  await fill("bankAccountNumber", "40817810099910004312")
  await fill("bankCorrespondentAccount", "30101810400000000225")
  await fill("bankBik", "044525225")
  await fill("bankInn", "7707083893")
  await fill("bankKpp", "773601001")

  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 60_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: `E2E RF ${runId}` })
})

test("data not RF full submit", async ({ page }) => {
  await page.goto("/forms/dataNotRF")
  const form = page.getByTestId("data-not-rf-form")
  await expect(form).toBeVisible()

  const fill = async (name: string, value: string) => {
    const el = form.locator(`[name="${name}"]`)
    if ((await el.count()) === 0) return
    await el.first().fill(value)
  }

  await fill("nickname", `E2E NotRF ${runId}`)
  await fill("telegramProfile", `@nr_${runId.slice(-6)}`)
  await fill("email", `test+notrf.${runId}@rossel.invalid`)
  await fill("passportFullName", "John Test Doe")
  await fill("passportIdNumber", "P1234567")
  await fill("taxId", "TAX-001")
  await fill("bankName", "Test Bank Intl")
  await fill("bankAccountNumber", "GB29NWBK60161331926819")

  // citizenship select if present
  const cit = form.locator('[name="citizenship"], select').first()
  if (await cit.count()) {
    try {
      await cit.selectOption({ index: 1 })
    } catch {
      /* custom select */
    }
  }

  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 90_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: `E2E NotRF ${runId}` })
})

test("catalog upload with files", async ({ page }) => {
  await page.goto("/forms/catalogUPLOAD")
  const form = page.getByTestId("catalog-upload-form")
  await expect(form).toBeVisible({ timeout: 30_000 })

  // release type single (1) is default often — fill title/artists
  const title = form.locator('[name="releaseTitle"], input').filter({ hasText: "" }).first()
  // Prefer labeled fields
  await form.getByPlaceholder(/назван/i).first().fill(`E2E Cat ${runId}`)
  const artistInputs = form.locator('input[placeholder*="Artist"], input[name="artists"], input[name="mainArtists"]')
  if (await artistInputs.count()) {
    await artistInputs.first().fill("E2E Artist")
  }

  // Track fields
  await form.locator('input[name="trackName"]').first().fill("E2E Track")
  await form.locator('input[name="mainArtists"]').first().fill("E2E Artist")
  await form.locator('input[name="isrc"]').first().fill("USRC17607839")
  await form.locator('input[name="previewStart"]').first().fill("00:10")
  await form.locator('input[name="musicAuthor"]').first().fill("Composer Test")
  const words = form.locator('input[name="wordsAuthor"]')
  if (await words.count()) await words.first().fill("Lyricist Test")

  // language select
  const lang = form.locator('select[name="language"], [name="language"]').first()
  if (await lang.count()) {
    try {
      await lang.selectOption({ index: 1 })
    } catch {
      /* custom */
    }
  }

  // files
  const cover = path.join(fixturesDir, "cover.png")
  const audio = path.join(fixturesDir, "audio.wav")
  const fileInputs = form.locator('input[type="file"]')
  const n = await fileInputs.count()
  if (n >= 1) await fileInputs.nth(0).setInputFiles(cover)
  if (n >= 2) await fileInputs.nth(1).setInputFiles(audio)

  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 180_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: `E2E Cat ${runId}` })
})

test("release upload with files", async ({ page }) => {
  await page.goto("/forms/releaseUPLOAD")
  const form = page.getByTestId("release-upload-form")
  await expect(form).toBeVisible()

  await form.locator('[name="artistNicknames"]').fill(`E2E Rel ${runId}`)
  await form.locator('[name="releaseTitle"]').fill(`E2E Release ${runId}`)

  // fill common track fields if present
  const trackName = form.locator('input[name="trackName"]')
  if (await trackName.count()) await trackName.first().fill("Track One")
  const mainArtists = form.locator('input[name="mainArtists"]')
  if (await mainArtists.count()) await mainArtists.first().fill("E2E Artist")
  const preview = form.locator('input[name="previewStart"]')
  if (await preview.count()) await preview.first().fill("00:15")
  const music = form.locator('input[name="musicAuthor"]')
  if (await music.count()) await music.first().fill("Composer")

  const files = form.locator('input[type="file"]')
  const count = await files.count()
  if (count >= 1) await files.nth(0).setInputFiles(path.join(fixturesDir, "cover.png"))
  if (count >= 2) await files.nth(1).setInputFiles(path.join(fixturesDir, "audio.wav"))

  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 180_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: `E2E Release ${runId}` })
})

test("distribution form with files", async ({ page }) => {
  await page.goto("/distribution")
  const form = page.getByTestId("distribution-form")
  await expect(form).toBeVisible()

  // Map common fields — distribution uses contact/artists/title
  const contact = form.locator('[name="contact"], input').first()
  await form.getByPlaceholder(/telegram|контакт/i).first().fill(`@dist_${runId.slice(-6)}`).catch(async () => {
    await contact.fill(`@dist_${runId.slice(-6)}`)
  })

  for (const [ph, val] of [
    [/артист|artist/i, `E2E Dist Artist ${runId}`],
    [/назван|title/i, `E2E Dist ${runId}`],
  ] as const) {
    const input = form.getByPlaceholder(ph).first()
    if (await input.count()) await input.fill(val)
  }

  const files = form.locator('input[type="file"]')
  const count = await files.count()
  if (count >= 1) await files.nth(0).setInputFiles(path.join(fixturesDir, "cover.png"))
  if (count >= 2) await files.nth(1).setInputFiles(path.join(fixturesDir, "audio.wav"))

  await form.getByTestId("form-submit").click()
  await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
    "data-status",
    "success",
    { timeout: 180_000 }
  )
  await drainOutbox(page.url())
  await assertBuildinSubmissionExists({ titleNeedle: `E2E Dist ${runId}` })
})
