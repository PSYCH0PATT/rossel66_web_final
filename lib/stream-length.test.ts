import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPaidStreamLength } from './stream-length'

test('isPaidStreamLength: платные категории', () => {
  assert.equal(isPaidStreamLength('Полный стрим'), true)
  assert.equal(isPaidStreamLength('Платный стрим (30+ сек)'), true)
  assert.equal(isPaidStreamLength('full'), true)
  // регистр/пробелы не влияют
  assert.equal(isPaidStreamLength('  ПОЛНЫЙ СТРИМ  '), true)
  assert.equal(isPaidStreamLength('платный стрим (30+ сек)'), true)
})

test('isPaidStreamLength: бесплатные категории (0–29 сек)', () => {
  assert.equal(isPaidStreamLength('0-5 сек'), false)
  assert.equal(isPaidStreamLength('6-29 сек'), false)
})

test('isPaidStreamLength: пустые/неизвестные значения', () => {
  assert.equal(isPaidStreamLength(''), false)
  assert.equal(isPaidStreamLength(null), false)
  assert.equal(isPaidStreamLength(undefined), false)
  assert.equal(isPaidStreamLength('что-то другое'), false)
})
