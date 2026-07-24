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
