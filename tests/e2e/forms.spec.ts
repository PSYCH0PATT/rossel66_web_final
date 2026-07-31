import { test, expect, type Locator, type Page } from "@playwright/test"
import path from "path"
import {
  assertBuildinSubmissionExists,
  drainOutbox,
  e2eRunId,
  fixturesDir,
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
  // Radix Select often exposes a second inert combobox; prefer the real trigger
  // button next to the label (htmlFor/id a11y names are unreliable here).
  const group = form.locator("label").filter({ hasText: label }).locator("xpath=..")
  const trigger = group.locator('button[role="combobox"]').first()
  if ((await trigger.count()) > 0) {
    await trigger.click()
  } else {
    await group.getByRole("combobox").locator("visible=true").first().click()
  }
  await page.getByRole("option", { name: option }).click()
}

async function fillName(form: Locator, name: string, value: string) {
  await form.locator(`[name="${name}"]:visible`).first().fill(value)
}

/** Radix selects inside track tables often have no accessible name. */
async function selectTrackLanguage(page: Page, form: Locator) {
  const row = form.locator("table tbody tr").first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  // Prefer the language cell (header "Язык"); fall back to first combobox in row.
  const langHeader = form.locator("table thead th", { hasText: /язык/i })
  const headerIndex = await langHeader.first().evaluate((el) => {
    const ths = Array.from(el.parentElement?.children || [])
    return ths.indexOf(el)
  })
  const cell =
    headerIndex >= 0
      ? row.locator("td").nth(headerIndex)
      : row
  await cell.getByRole("combobox").first().click()
  await page.getByRole("option", { name: /^Без слов$/i }).click()
}

async function attachCoverAndAudio(form: Locator) {
  // Inputs are `className="hidden"` — do not filter :visible
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
  if (coverIdx >= 0) await candidates.nth(coverIdx).setInputFiles(cover)
  else if (count >= 1) await candidates.nth(0).setInputFiles(cover)
  if (audioIdx >= 0) await candidates.nth(audioIdx).setInputFiles(audio)
  else if (count >= 2) await candidates.nth(1).setInputFiles(audio)
}

test.describe.serial("forms e2e", () => {
  test("contact form full submit", async ({ page }) => {
    const nick = `E2E Contact ${runId}`
    await page.goto("/")
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
    if (await cit.count()) {
      await cit.click()
      await page.getByRole("option").nth(1).click()
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
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto("/forms/catalogUPLOAD")
    const form = page.getByTestId("catalog-upload-form")
    await expect(form).toBeVisible({ timeout: 30_000 })

    // Альбом → видны trackName/mainArtists (на staging до redeploy сингл слал пустой trackTitle)
    await selectByLabel(page, form, /тип релиза/i, /^Альбом$/i)
    await form.getByLabel(/название релиза/i).fill(`E2E Cat ${runId}`)
    await form.getByLabel(/никнеймы артистов релиза/i).fill("E2E Artist")
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
    await page.setViewportSize({ width: 1400, height: 900 })
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

    const explicit = form.getByRole("combobox", { name: /мат/i })
    if (await explicit.count()) {
      await explicit.first().click()
      await page.getByRole("option", { name: /^Нет$/i }).click()
    } else {
      const row = form.locator("table tbody tr").first()
      const boxes = row.getByRole("combobox")
      if ((await boxes.count()) >= 2) {
        await boxes.nth(1).click()
        await page.getByRole("option", { name: /^Нет$/i }).click()
      }
    }

    for (const label of [
      /видео-сниппет/i,
      /подавать релиз на промо/i,
      /соц\. сети/i,
      /стриминговых площадках/i,
    ]) {
      const box = form.getByRole("combobox", { name: label })
      if (await box.count()) {
        await box.first().click()
        await page.getByRole("option", { name: /^Нет$/i }).click()
      }
    }

    await attachCoverAndAudio(form)

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
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto("/distribution")
    const form = page.getByTestId("distribution-form")
    await expect(form).toBeVisible()

    await fillName(form, "artists", `E2E Dist Artist ${runId}`)
    await fillName(form, "title", `E2E Dist ${runId}`)
    await selectByLabel(page, form, /тип релиза/i, /Сингл \(1 трек\)/i)
    await fillName(form, "releaseDate", "2026-08-20")
    await selectByLabel(page, form, /^жанр/i, /Hip Hop\/Rap/i)
    await fillName(form, "contact", `@dist_${runId.slice(-6)}`)

    await form.locator('table input[name="trackName"]').first().fill("Dist Track")
    await form.locator('table input[name="mainArtists"]').first().fill("E2E Dist Artist")
    await form.locator('table input[name="previewStart"]').first().fill("00:12")
    await form.locator('table input[name="musicAuthor"]').first().fill("Composer Dist")
    await selectTrackLanguage(page, form)

    const row = form.locator("table tbody tr").first()
    const boxes = row.getByRole("combobox")
    if ((await boxes.count()) >= 2) {
      await boxes.nth(1).click()
      await page.getByRole("option", { name: /^Нет$/i }).click()
    }

    for (const label of [
      /видео-сниппет/i,
      /подавать релиз на промо/i,
      /стриминговых площадках/i,
    ]) {
      await selectByLabel(page, form, label, /^Нет$/i)
    }

    await attachCoverAndAudio(form)

    await form.getByTestId("form-submit").click()
    await expect(page.getByTestId("form-submit-status")).toHaveAttribute(
      "data-status",
      "success",
      { timeout: 180_000 }
    )
    await drainOutbox(page.url())
    await assertBuildinSubmissionExists({ titleNeedle: `E2E Dist ${runId}` })
  })
})
