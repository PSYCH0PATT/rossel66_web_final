import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listSkeletonCount } from './list-skeleton'

/**
 * F-86 — на 390 при скролле встречался целый вьюпорт пустого фона: на время
 * загрузки список схлопывался в один спиннер (а сетка плейлистов не рисовала
 * вообще ничего), потом карточки «всплывали». Место под будущие карточки надо
 * держать — столько же, сколько их придёт.
 */
test('F-86: первая загрузка — заглушек на страницу выдачи', () => {
  assert.equal(listSkeletonCount({ pageSize: 20 }), 20)
})

test('F-86: на последней странице заглушек столько, сколько там карточек', () => {
  assert.equal(listSkeletonCount({ pageSize: 20, total: 45, page: 3 }), 5)
  assert.equal(listSkeletonCount({ pageSize: 20, total: 45, page: 1 }), 20)
})

test('F-86: при перезагрузке того же экрана держим высоту уже показанного списка', () => {
  assert.equal(listSkeletonCount({ pageSize: 100, previousCount: 12 }), 12)
})

test('F-86: пустая выдача заглушек не рисует — там пустое состояние', () => {
  assert.equal(listSkeletonCount({ pageSize: 20, total: 0 }), 0)
  assert.equal(listSkeletonCount({ pageSize: 20, total: 45, page: 4 }), 0)
})

test('F-86: заглушек не больше потолка — экран не длиннее пары вьюпортов', () => {
  assert.equal(listSkeletonCount({ pageSize: 100 }), 24)
  assert.equal(listSkeletonCount({ pageSize: 100, max: 8 }), 8)
})
