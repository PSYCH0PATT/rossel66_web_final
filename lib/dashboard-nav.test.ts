import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardNavRole, isNavItemActive } from './dashboard-nav'

/**
 * F-56 — из админ-сессии кабинет артиста открывался с админским сайдбаром
 * («Панель управления», пункты админки), а активный пункт не подсвечивался.
 * Набор пунктов задаёт кабинет, в котором ты находишься, а не роль сессии.
 */
test('F-56: в кабинете артиста сайдбар артистский даже для админ-сессии', () => {
  assert.equal(
    dashboardNavRole({ sessionRole: 'admin', pathname: '/dashboard/artist/rompy/dashboard' }),
    'artist'
  )
  assert.equal(
    dashboardNavRole({ sessionRole: 'admin', pathname: '/dashboard/artist/rompy/playlists/12' }),
    'artist'
  )
})

test('F-56: на админских роутах сайдбар остаётся админским', () => {
  assert.equal(
    dashboardNavRole({ sessionRole: 'admin', pathname: '/dashboard/admin/playlists' }),
    'admin'
  )
  // Вне обоих кабинетов (логин, редиректы) отталкиваемся от роли сессии.
  assert.equal(dashboardNavRole({ sessionRole: 'artist', pathname: '/dashboard' }), 'artist')
  assert.equal(dashboardNavRole({ sessionRole: 'admin', pathname: '/dashboard' }), 'admin')
})

const ARTIST_HREFS = [
  '/dashboard/artist/rompy/dashboard',
  '/dashboard/artist/rompy/analytics',
  '/dashboard/artist/rompy/releases',
  '/dashboard/artist/rompy/reports',
  '/dashboard/artist/rompy/payments',
  '/dashboard/artist/rompy/playlists',
]

const ADMIN_HREFS = [
  '/dashboard/admin/dashboard',
  '/dashboard/admin/artists',
  '/dashboard/admin/releases',
  '/dashboard/admin/reports',
  '/dashboard/admin/payments',
  '/dashboard/admin/reports-generator',
  '/dashboard/admin/playlists',
  '/dashboard/admin/playlists/history',
  '/dashboard/admin/analytics',
  '/dashboard/admin/activity',
]

test('F-56: раздел подсвечен и на вложенной странице', () => {
  const active = ARTIST_HREFS.filter((href) =>
    isNavItemActive('/dashboard/artist/rompy/releases/42', href, ARTIST_HREFS)
  )
  assert.deepEqual(active, ['/dashboard/artist/rompy/releases'])
})

test('F-56: вложенный раздел не подсвечивает родителя — подсвечен ровно один пункт', () => {
  const active = ADMIN_HREFS.filter((href) =>
    isNavItemActive('/dashboard/admin/playlists/history', href, ADMIN_HREFS)
  )
  assert.deepEqual(active, ['/dashboard/admin/playlists/history'])
})

test('F-56: соседний раздел с общим префиксом не подсвечивается', () => {
  const active = ADMIN_HREFS.filter((href) =>
    isNavItemActive('/dashboard/admin/reports-generator', href, ADMIN_HREFS)
  )
  assert.deepEqual(active, ['/dashboard/admin/reports-generator'])
})

test('F-56: на странице вне навигации не подсвечен никто', () => {
  const active = ARTIST_HREFS.filter((href) =>
    isNavItemActive('/dashboard/artist/rompy/settings', href, ARTIST_HREFS)
  )
  assert.deepEqual(active, [])
})
