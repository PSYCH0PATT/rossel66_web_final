import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  TEST_ACCOUNT_EMAIL_DOMAINS,
  TEST_ACCOUNT_USERNAMES,
  TEST_ACCOUNT_USERNAME_PREFIXES,
  isTestAccount,
  excludeTestAccountsWhere,
  shouldHideTestAccounts,
} from './test-accounts'

/**
 * F-37 — в боевом списке артистов висели карточки «test» и учётки прогонов.
 * Признак тестовой учётки должен быть один и записан в коде, иначе чистка
 * данных обнуляется следующим же прогоном.
 */
test('F-37: тестовые учётки опознаются по логину и по почте стенда', () => {
  assert.equal(isTestAccount({ username: 'test' }), true)
  assert.equal(isTestAccount({ username: 'TEST' }), true)
  assert.equal(isTestAccount({ username: 'e2e-main' }), true)
  assert.equal(isTestAccount({ username: 'demo' }), true)
  assert.equal(isTestAccount({ username: 'rompy', email: 'rompy@example.test' }), true)
})

test('F-37: живых артистов правило не задевает', () => {
  // Реальные имена из scripts/seed-data/artist-contracts.json и живых прогонов.
  for (const username of ['cherrypiertd', 'BORDUN', 'Coldn1ght', 'rompy', 'skaya', 'testarossa']) {
    assert.equal(isTestAccount({ username }), false, `${username} принят за тестовую учётку`)
  }
  assert.equal(isTestAccount({ username: 'protest', email: 'protest@rossel.ru' }), false)
})

test('F-37: сид стенда живёт по этому же правилу — иначе учётки прогонов утекают в бой', () => {
  const seed = fs.readFileSync(path.join(process.cwd(), 'scripts/seed-e2e.ts'), 'utf8')
  const usernames = [...seed.matchAll(/username: "([^"]+)"/g)].map((m) => m[1])
  const seeded = [...seed.matchAll(/artist\("[^"]+", "([^"]+)"/g)].map((m) => m[1])
  const all = [...usernames, ...seeded]

  assert.ok(all.length >= 5, 'не нашли логинов в scripts/seed-e2e.ts')
  for (const username of all) {
    assert.equal(isTestAccount({ username }), true, `сид заводит «${username}» вне правила`)
  }
})

test('F-37: фильтр для запроса собран из тех же признаков', () => {
  assert.deepEqual(excludeTestAccountsWhere(), {
    NOT: [
      { username: { in: [...TEST_ACCOUNT_USERNAMES], mode: 'insensitive' } },
      ...TEST_ACCOUNT_USERNAME_PREFIXES.map((prefix) => ({
        username: { startsWith: prefix, mode: 'insensitive' as const },
      })),
      ...TEST_ACCOUNT_EMAIL_DOMAINS.map((domain) => ({
        email: { endsWith: domain, mode: 'insensitive' as const },
      })),
    ],
  })
})

test('F-37: на стенде учётки прогонов остаются видимыми — иначе списки там пусты', () => {
  assert.equal(shouldHideTestAccounts(true, {}), true)
  assert.equal(shouldHideTestAccounts(true, { SHOW_TEST_ACCOUNTS: 'true' }), false)
  // Экраны, которые фильтр не просили, он не трогает вовсе.
  assert.equal(shouldHideTestAccounts(false, {}), false)
})
