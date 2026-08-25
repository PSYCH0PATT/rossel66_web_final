import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ACTIVITY_VIEWS, ARTIST_FEED_VIEW, activityViewFilter, isActivityView } from './activity-views'

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

/**
 * Б-24: у артиста тройка другая — статусы релизов · плейлисты · отчётность
 * (0-б, артист-ЛК; ответ владельца №8). Авансы — внутренняя бухгалтерия
 * лейбла, в кабинет они не попадают.
 */
test('Б-24: артистский вид — статусы релизов, плейлисты и отчётность', () => {
  const artist = activityViewFilter(ARTIST_FEED_VIEW)
  for (const wanted of [
    'release_status_updated',
    'release_added',
    'playlist_found',
    'parser_playlist_found',
    'report_status_changed',
    'report_received',
  ]) {
    assert.ok(artist.types.includes(wanted as never), wanted)
  }
  // Оговорка №5 (самостоятельные действия артиста) — про журнал владельца:
  // артисту обещаны ТОЛЬКО три группы, и ничего сверх них.
  assert.equal(artist.includeArtistSelfProfile, false)
})

test('Б-24: чужая бухгалтерия и системный шум артисту не приходят', () => {
  const artist = activityViewFilter(ARTIST_FEED_VIEW)
  for (const forbidden of [
    'advance_issued',
    'advance_removed',
    'payment_sent',
    'reports_generated',
    'user_data_updated',
    'artist_added',
    'artist_removed',
    'artist_auto_created',
    'analytics_import',
    'analytics_cleanup',
    'parser_started',
    'parser_completed',
    'parser_error',
  ]) {
    assert.equal(artist.types.includes(forbidden as never), false, forbidden)
  }
})

test('Б-24: артистский вид не меняет состав админского «Главного»', () => {
  const main = activityViewFilter('main')
  assert.deepEqual(main.types, [
    'playlist_found',
    'parser_playlist_found',
    'report_status_changed',
    'parser_error',
  ])
  assert.equal(main.includeArtistSelfProfile, true)
})

test('Б-24: вид ленты кабинета проходит проверку query-параметра', () => {
  assert.equal(isActivityView(ARTIST_FEED_VIEW), true)
  assert.ok(ACTIVITY_VIEWS.includes(ARTIST_FEED_VIEW))
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
