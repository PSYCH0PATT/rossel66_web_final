import { test } from "node:test"
import assert from "node:assert/strict"

import { PLATFORM_BADGE_COLORS, platformBadgeColors, platformKey } from "./platform-colors"

test("площадка опознаётся в любом написании", () => {
  assert.equal(platformKey("VK Музыка"), "vk")
  assert.equal(platformKey("вк"), "vk")
  assert.equal(platformKey("Яндекс.Музыка"), "yandex")
  assert.equal(platformKey("Yandex Music"), "yandex")
  assert.equal(platformKey("МТС Музыка"), "mts")
  assert.equal(platformKey("Sber Zvuk"), "sber")
  assert.equal(platformKey("Одноклассники"), "ok")
})

test("неизвестная и пустая площадка дают серый фолбэк", () => {
  assert.equal(platformKey("Apple Music"), "unknown")
  assert.equal(platformKey(null), "unknown")
  assert.equal(platformKey(""), "unknown")
  assert.equal(platformBadgeColors(undefined).bg, "#6b7280")
})

test("цвета совпадают с текущими бейджами /playlists", () => {
  // Значения дословно из getPlatformBadgeStyle() в admin/playlists/page.tsx —
  // подстановка на этапе 4 не должна сдвинуть ни один пиксель.
  assert.deepEqual(platformBadgeColors("VK Музыка"), { bg: "#0077FF", color: "#FFFFFF", icon: "0077FF" })
  assert.deepEqual(platformBadgeColors("Яндекс Музыка"), { bg: "#FFCC00", color: "#000000", icon: "FFCC00" })
  assert.deepEqual(platformBadgeColors("МТС"), { bg: "#E30611", color: "#FFFFFF", icon: "E30611" })
  assert.deepEqual(platformBadgeColors("Сбер"), { bg: "#21A038", color: "#FFFFFF", icon: "21A038" })
  assert.deepEqual(platformBadgeColors("Одноклассники"), { bg: "#EE8208", color: "#FFFFFF", icon: "EE8208" })
})

test("у Яндекса текст чёрный, у остальных белый", () => {
  for (const [key, colors] of Object.entries(PLATFORM_BADGE_COLORS)) {
    assert.equal(colors.color, key === "yandex" ? "#000000" : "#FFFFFF")
  }
})

test("«ОК» без слова «одноклассники» тоже опознаётся — расхождение с текущей страницей", () => {
  // Страница ловила только «одноклассник»/«odnoklassniki», общий предикат
  // lib/playlist-platform.ts ловит ещё «ok». Расхождение зафиксировано здесь,
  // чтобы на этапе 4 оно было решением, а не сюрпризом.
  assert.equal(platformKey("OK"), "ok")
  assert.equal(platformKey("ok музыка"), "ok")
})
