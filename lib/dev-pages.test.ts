import { test, afterEach } from "node:test"
import assert from "node:assert/strict"

import { devPagesEnabled } from "./dev-pages"

/**
 * Гейт витрин `/dev/**`. Проверяется именно предикат, а не `requireDevPages()`:
 * тот зовёт `notFound()` из next/navigation, который вне рендера Next бросает
 * своё исключение и о состоянии окружения ничего не сообщает.
 *
 * Смысл теста — в том, что закрыто по умолчанию. Ошибка здесь не роняет сборку
 * и не видна на глаз: страница просто останется открытой на боевом домене.
 */
const NODE_ENV = process.env.NODE_ENV
const FLAG = process.env.ENABLE_DEV_PAGES

function setEnv(nodeEnv: string, flag?: string) {
  // NODE_ENV в типах Node объявлен только для чтения, но в рантайме это
  // обычное свойство process.env — тестам нужно им управлять.
  ;(process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv
  ;(process.env as Record<string, string | undefined>).ENABLE_DEV_PAGES = flag
}

afterEach(() => setEnv(NODE_ENV ?? "test", FLAG))

test("витрины закрыты в production, пока флаг не выставлен", () => {
  setEnv("production", undefined)
  assert.equal(devPagesEnabled(), false, "на бою переменной нет — должно быть закрыто")
})

test("в production открываются только явной единицей", () => {
  setEnv("production", "1")
  assert.equal(devPagesEnabled(), true)

  for (const almost of ["0", "true", "yes", "", " 1"]) {
    setEnv("production", almost)
    assert.equal(devPagesEnabled(), false, `«${almost}» не должно открывать витрины`)
  }
})

test("вне production открыты всегда — локальная разработка не требует флага", () => {
  setEnv("development", undefined)
  assert.equal(devPagesEnabled(), true)

  setEnv("test", undefined)
  assert.equal(devPagesEnabled(), true)
})
