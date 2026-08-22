import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { dashboardHomeHref } from './dashboard-home'
import { DashboardNotFound } from '@/components/dashboard-not-found'

/**
 * F-95 — артист, попавший на админский роут (`/dashboard/admin/dashboard`),
 * получал голый ненайденный экран Next: «404 | This page could not be found.»
 * — по-английски, без брендинга и без выхода. Доступ закрыт правильно, тупик —
 * нет: у страницы должен быть человеческий текст и дорога обратно в кабинет.
 */
test('F-95: дорога назад ведёт в кабинет вошедшего', () => {
  assert.equal(
    dashboardHomeHref({ id: '1', username: 'rompy', role: 'artist' }),
    '/dashboard/artist/rompy/dashboard'
  )
  assert.equal(
    dashboardHomeHref({ id: '2', username: 'admin', role: 'admin' }),
    '/dashboard/admin/dashboard'
  )
  // Не вошёл — идти в кабинет некуда, ведём на логин.
  assert.equal(dashboardHomeHref(null), '/dashboard/login')
})

test('F-95: страница по-русски, с брендом и кнопкой возврата', () => {
  const html = renderToStaticMarkup(
    createElement(DashboardNotFound, { homeHref: '/dashboard/artist/rompy/dashboard' })
  )

  assert.ok(!html.includes('This page could not be found'), 'английская заглушка Next осталась')
  assert.ok(html.includes('Вернуться в кабинет'), 'нет кнопки возврата')
  assert.ok(html.includes('href="/dashboard/artist/rompy/dashboard"'), 'кнопка ведёт не в кабинет')
  assert.ok(/Страниц[аы]/i.test(html), 'нет человеческого объяснения по-русски')
  assert.ok(html.includes('/images/logo.png'), 'нет логотипа')
})
