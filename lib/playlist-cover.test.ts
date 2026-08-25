import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPlaylistCoverUrl } from './playlist-cover'

test('getPlaylistCoverUrl: coverUrl имеет приоритет', () => {
  assert.equal(
    getPlaylistCoverUrl('VK Музыка', 'https://example.com/cover.jpg'),
    'https://example.com/cover.jpg'
  )
})

test('getPlaylistCoverUrl: плейсхолдер по платформе (регистр/написание не важны)', () => {
  const vk = '/images/playlists/vk-music.png'
  assert.equal(getPlaylistCoverUrl('VK Музыка'), vk)
  assert.equal(getPlaylistCoverUrl('VK Music'), vk)
  assert.equal(getPlaylistCoverUrl('вк музыка'), vk)

  const ya = '/images/playlists/yandex-music.png'
  assert.equal(getPlaylistCoverUrl('Яндекс Музыка'), ya)
  assert.equal(getPlaylistCoverUrl('Яндекс.Музыка'), ya)
  assert.equal(getPlaylistCoverUrl('yandex music'), ya)

  assert.equal(getPlaylistCoverUrl('МТС Музыка'), '/images/playlists/mts-music.png')
  assert.equal(getPlaylistCoverUrl('Sber Music'), '/images/playlists/sber-music.png')
})

test('getPlaylistCoverUrl: неизвестная/пустая платформа → placeholder.svg', () => {
  assert.equal(getPlaylistCoverUrl('Spotify'), '/placeholder.svg')
  assert.equal(getPlaylistCoverUrl(''), '/placeholder.svg')
  assert.equal(getPlaylistCoverUrl(null), '/placeholder.svg')
})

/**
 * F-06 — в админ-сетке все 13 обложек Яндекс-секции и 2 в МТС были битыми
 * картинками с alt-текстом. Причина не в разметке: в поле cover_url лежат
 * значения, которые браузер и next/image отрисовать не могут — сырой uri
 * Яндекса без схемы, неразрешённый плейсхолдер размера `%%`, хост вне
 * remotePatterns. Правило одно: если URL нерисуемый, отдаём заглушку
 * платформы, а не битую картинку.
 */
test('F-06: сырой uri Яндекса без схемы → абсолютный https, а не относительный путь', () => {
  assert.equal(
    getPlaylistCoverUrl('Яндекс Музыка', 'avatars.yandex.net/get-music-content/123/abc/%%'),
    'https://avatars.yandex.net/get-music-content/123/abc/m400x400'
  )
})

test('F-06: неразрешённый плейсхолдер размера %% внутри пути заменяется', () => {
  assert.equal(
    getPlaylistCoverUrl('Яндекс Музыка', 'https://avatars.mds.yandex.net/get-music-content/9/x/%%'),
    'https://avatars.mds.yandex.net/get-music-content/9/x/m400x400'
  )
})

test('F-06: хост, которого нет в remotePatterns, next/image не отдаст → заглушка платформы', () => {
  assert.equal(
    getPlaylistCoverUrl('МТС Музыка', 'https://cdn-media.mts.ru/covers/42.jpg'),
    '/images/playlists/mts-music.png'
  )
})

test('F-06: мусор в cover_url (data:, http, пустой путь) → заглушка платформы', () => {
  assert.equal(
    getPlaylistCoverUrl('Яндекс Музыка', 'data:image/gif;base64,R0lGOD'),
    '/images/playlists/yandex-music.png'
  )
  assert.equal(
    getPlaylistCoverUrl('Яндекс Музыка', 'http://avatars.yandex.net/get-music-content/1/2/400x400'),
    '/images/playlists/yandex-music.png'
  )
  assert.equal(getPlaylistCoverUrl('VK Музыка', '   '), '/images/playlists/vk-music.png')
})

test('F-06: живой URL с разрешённого хоста остаётся как есть', () => {
  assert.equal(
    getPlaylistCoverUrl('VK Музыка', 'https://sun9-1.userapi.com/impg/abc/cover.jpg'),
    'https://sun9-1.userapi.com/impg/abc/cover.jpg'
  )
})
