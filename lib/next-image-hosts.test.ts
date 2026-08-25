import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { NEXT_IMAGE_REMOTE_HOSTS, isNextImageRemoteHostAllowed } from './next-image-hosts'

/**
 * Список хостов дублирует `images.remotePatterns` из next.config.mjs (импортировать
 * ESM-конфиг сборки в рантайм нельзя). Разойдутся — и правило F-06 начнёт прятать
 * живые обложки за заглушкой либо пропускать битые.
 */
test('список хостов совпадает с images.remotePatterns в next.config.mjs', () => {
  const config = fs.readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8')
  const images = config.slice(config.indexOf('images: {'))
  const fromConfig = [...images.matchAll(/hostname:\s*'([^']+)'/g)].map((m) => m[1])

  assert.ok(fromConfig.length > 0, 'не нашли hostname в next.config.mjs')
  assert.deepEqual([...NEXT_IMAGE_REMOTE_HOSTS].sort(), fromConfig.sort())
})

test('шаблон **. матчит поддомены и не матчит апекс', () => {
  assert.equal(isNextImageRemoteHostAllowed('sun9-1.userapi.com'), true)
  assert.equal(isNextImageRemoteHostAllowed('a.b.userapi.com'), true)
  assert.equal(isNextImageRemoteHostAllowed('userapi.com'), false)
})

test('точный хост матчится целиком, чужой — нет', () => {
  assert.equal(isNextImageRemoteHostAllowed('avatars.yandex.net'), true)
  assert.equal(isNextImageRemoteHostAllowed('AVATARS.YANDEX.NET'), true)
  assert.equal(isNextImageRemoteHostAllowed('evil-avatars.yandex.net'), false)
  assert.equal(isNextImageRemoteHostAllowed('cdn-media.mts.ru'), false)
  assert.equal(isNextImageRemoteHostAllowed(''), false)
})
