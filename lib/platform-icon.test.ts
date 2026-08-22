import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { PLATFORM_ICONS, getPlatformIconSrc } from './platform-icon'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

/**
 * F-07 — у полей «Яндекс Музыка» и «Spotify» в формах артиста вместо иконок
 * висели битые картинки. Причина: иконки брались из внешнего CDN
 * (cdn.simpleicons.org) и из несуществующего файла /spotify-logo.png. Иконки
 * платформ живут в public/images/dsp-icons и подставляются одним правилом.
 */
test('F-07: иконка платформы — локальный файл, который реально лежит в public', () => {
  for (const [platform, src] of Object.entries(PLATFORM_ICONS)) {
    assert.ok(src.startsWith('/images/dsp-icons/'), `${platform}: ожидали локальный путь, получили ${src}`)
    assert.ok(
      fs.existsSync(path.join(PUBLIC_DIR, src.replace(/^\//, ''))),
      `${platform}: файла ${src} нет в public/`
    )
  }
})

test('F-07: платформа опознаётся по русскому и английскому написанию', () => {
  assert.equal(getPlatformIconSrc('Яндекс Музыка'), PLATFORM_ICONS.yandex)
  assert.equal(getPlatformIconSrc('yandex music'), PLATFORM_ICONS.yandex)
  assert.equal(getPlatformIconSrc('ВК Музыка'), PLATFORM_ICONS.vk)
  assert.equal(getPlatformIconSrc('Spotify'), PLATFORM_ICONS.spotify)
  assert.equal(getPlatformIconSrc('МТС Музыка'), PLATFORM_ICONS.mts)
  assert.equal(getPlatformIconSrc('Сбер Звук'), PLATFORM_ICONS.sber)
  assert.equal(getPlatformIconSrc('Boomplay'), null)
})

/**
 * Тот же баг, но со стороны экранов: форма не должна тянуть иконку из интернета
 * (CSP `img-src` её пропускает, а вот доступность CDN никто не гарантирует) и не
 * должна ссылаться на файл, которого нет.
 */
test('F-07: формы артиста не ссылаются на внешние иконки и на отсутствующие файлы', () => {
  const screens = [
    'app/dashboard/admin/artists/add/page.tsx',
    'app/dashboard/admin/artists/[id]/page.tsx',
  ]

  for (const screen of screens) {
    const source = fs.readFileSync(path.join(process.cwd(), screen), 'utf8')

    const external = [...source.matchAll(/src="(https?:\/\/[^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(external, [], `${screen}: иконки грузятся из внешнего CDN`)

    for (const [, src] of source.matchAll(/src="(\/[^"{}]+)"/g)) {
      assert.ok(
        fs.existsSync(path.join(PUBLIC_DIR, src.replace(/^\//, ''))),
        `${screen}: файла ${src} нет в public/`
      )
    }
  }
})
