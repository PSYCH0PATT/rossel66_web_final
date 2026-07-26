import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dedupePlaylistsByUrlAndName } from './playlist-artist-match'

const ME = 'user_me'

function row(over: Partial<{
  id: string
  playlistUrl: string
  playlistName: string
  artistId: string | null
  updatedAt: Date
  trackData: unknown
}> = {}) {
  return {
    id: 'r1',
    playlistUrl: 'https://music.yandex.ru/playlists/1',
    playlistName: 'Плейлист',
    artistId: null as string | null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    trackData: [] as unknown,
    ...over,
  }
}

test('дедуп: одна карточка на плейлист', () => {
  const out = dedupePlaylistsByUrlAndName([row({ id: 'a' }), row({ id: 'b' })], ME)
  assert.equal(out.length, 1)
})

test('дедуп: приоритет у строки, привязанной к этому артисту', () => {
  const out = dedupePlaylistsByUrlAndName(
    [row({ id: 'unassigned' }), row({ id: 'mine', artistId: ME }), row({ id: 'other', artistId: 'user_x' })],
    ME
  )
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'mine')
})

test('H7: треки схлопнутых строк объединяются, а не теряются', () => {
  const mine = row({
    id: 'mine',
    artistId: ME,
    trackData: [{ isrc: 'RU1', trackTitle: 'Трек 1', position: 3 }],
  })
  const collab = row({
    id: 'collab',
    trackData: [{ isrc: 'RU2', trackTitle: 'Трек 2', position: 7 }],
  })

  const out = dedupePlaylistsByUrlAndName([mine, collab], ME)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'mine')

  const tracks = out[0].trackData as Array<Record<string, unknown>>
  assert.equal(tracks.length, 2, 'трек проигравшей строки не должен исчезать')
  // порядок победителя сохраняется
  assert.deepEqual(tracks.map((t) => t.isrc), ['RU1', 'RU2'])
})

test('H7: одинаковые треки не дублируются при объединении', () => {
  const same = { isrc: 'RU1', trackTitle: 'Трек 1', position: 3 }
  const out = dedupePlaylistsByUrlAndName(
    [
      row({ id: 'mine', artistId: ME, trackData: [same] }),
      row({ id: 'dup', trackData: [{ ...same }] }),
    ],
    ME
  )
  assert.equal((out[0].trackData as unknown[]).length, 1)
})

test('H7: трек без ISRC сопоставляется по названию и позиции', () => {
  const out = dedupePlaylistsByUrlAndName(
    [
      row({ id: 'mine', artistId: ME, trackData: [{ titleArtist: 'Трек - Артист', position: 1 }] }),
      row({ id: 'other', trackData: [{ titleArtist: 'Трек - Артист', position: 1 }, { titleArtist: 'Другой', position: 2 }] }),
    ],
    ME
  )
  const tracks = out[0].trackData as Array<Record<string, unknown>>
  assert.equal(tracks.length, 2)
})

test('дедуп: разные плейлисты не схлопываются', () => {
  const out = dedupePlaylistsByUrlAndName(
    [row({ id: 'a' }), row({ id: 'b', playlistName: 'Другой плейлист' })],
    ME
  )
  assert.equal(out.length, 2)
})
