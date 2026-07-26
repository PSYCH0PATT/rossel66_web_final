import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTracks } from './storage-adapters'

test('E3: не-массив в tracks не роняет код', () => {
  assert.deepEqual(normalizeTracks(null), [])
  assert.deepEqual(normalizeTracks(undefined), [])
  assert.deepEqual(normalizeTracks('[]'), [])
  assert.deepEqual(normalizeTracks({ title: 'Трек' }), [])
  assert.deepEqual(normalizeTracks(42), [])
})

test('E3: пустой title заменяется на «Без названия»', () => {
  const tracks = normalizeTracks([{ title: '   ' }, { title: 'Трек 2' }, {}])
  assert.deepEqual(
    tracks.map((t) => t.title),
    ['Без названия', 'Трек 2', 'Без названия']
  )
})

test('E3: мусорные элементы отбрасываются', () => {
  const tracks = normalizeTracks([null, 'строка', { title: 'Ок' }, 7])
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].title, 'Ок')
})

test('E3: id и trackNumber заполняются, если отсутствуют', () => {
  const tracks = normalizeTracks([{ title: 'A' }, { title: 'B', id: 'real_id', trackNumber: 9 }])
  assert.equal(tracks[0].id, 'track_1')
  assert.equal(tracks[0].trackNumber, 1)
  assert.equal(tracks[1].id, 'real_id')
  assert.equal(tracks[1].trackNumber, 9)
})

test('E3: duration всегда строка (нечисловой мусор не протекает)', () => {
  const tracks = normalizeTracks([{ title: 'A', duration: 215 }, { title: 'B', duration: ' 3:15 ' }])
  assert.equal(tracks[0].duration, '')
  assert.equal(tracks[1].duration, '3:15')
})

test('E3: прочие поля трека сохраняются', () => {
  const tracks = normalizeTracks([
    { title: 'A', isrc: 'RU123', royaltyShares: { artist: 60 } },
  ])
  assert.equal(tracks[0].isrc, 'RU123')
  assert.deepEqual(tracks[0].royaltyShares, { artist: 60 })
})
