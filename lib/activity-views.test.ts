import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityViewFilter, isActivityView } from './activity-views'

/**
 * 0-б: дефолт журнала — три желания владельца (плейлисты, подписания,
 * поломки) плюс оговорка ответа №5 про самостоятельные действия артиста.
 */
test('0-б: «Главное» — три типа владельца и самостоятельные действия артиста', () => {
  const main = activityViewFilter('main')
  assert.ok(main.types.includes('playlist_found'))
  assert.ok(main.types.includes('parser_playlist_found'))
  assert.ok(main.types.includes('report_status_changed'))
  assert.ok(main.types.includes('parser_error'))
  assert.equal(main.includeArtistSelfProfile, true)
})

test('0-б: системный шум в дефолт не попадает', () => {
  const main = activityViewFilter('main')
  // Кроновые добавления релизов, импорт аналитики и обновления профилей
  // «Системой» живут только под «Все события».
  for (const noisy of ['release_added', 'analytics_import', 'user_data_updated', 'artist_added']) {
    assert.equal(main.types.includes(noisy as never), false, noisy)
  }
})

test('0-б: узкие виды не тянут за собой оговорку про профиль артиста', () => {
  for (const view of ['playlists', 'signatures', 'errors'] as const) {
    assert.equal(activityViewFilter(view).includeArtistSelfProfile, false, view)
  }
  assert.deepEqual(activityViewFilter('playlists').types, ['playlist_found', 'parser_playlist_found'])
  assert.deepEqual(activityViewFilter('signatures').types, ['report_status_changed'])
  assert.deepEqual(activityViewFilter('errors').types, ['parser_error'])
})

test('0-б: «Все события» ничего не фильтруют', () => {
  const all = activityViewFilter('all')
  assert.deepEqual(all.types, [])
  assert.equal(all.includeArtistSelfProfile, false)
})

test('вид из query проверяется, мусор не проходит', () => {
  assert.equal(isActivityView('main'), true)
  assert.equal(isActivityView('all'), true)
  assert.equal(isActivityView('release_added'), false)
  assert.equal(isActivityView(''), false)
  assert.equal(isActivityView(undefined), false)
})
