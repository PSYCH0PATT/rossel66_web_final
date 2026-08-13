/**
 * Отметка начала предпрослушивания по умолчанию.
 *
 * Раньше поле предзаполнялось значением 00:30, и его почти всегда правили руками.
 * Проверяем все три формы, где заводятся треки.
 */
import { expect, test } from "@playwright/test"

const FORMS = [
  { path: "/forms/releaseUPLOAD", title: "загрузка релиза" },
  { path: "/distribution", title: "дистрибуция" },
  { path: "/forms/catalogUPLOAD", title: "бэк-каталог" },
]

for (const form of FORMS) {
  test(`${form.title}: начало предпрослушивания предзаполнено 00:00`, async ({ page }) => {
    await page.goto(form.path)
    const field = page.locator('input[name="previewStart"]').first()
    await expect(field).toBeVisible()
    await expect(field).toHaveValue("00:00")
    await expect(field).toHaveAttribute("placeholder", "00:00")
  })
}
