import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReleaseDate, parseReleaseDateToTimestamp } from './release-date'

test('A1: DD.MM.YYYY (парсеры Koala/Zvonko) приводится к YYYY-MM-DD', () => {
  assert.equal(normalizeReleaseDate('25.07.2026'), '2026-07-25')
  assert.equal(normalizeReleaseDate('01.01.2025'), '2025-01-01')
  // без ведущих нулей
  assert.equal(normalizeReleaseDate('5.3.2026'), '2026-03-05')
})

test('A1: уже канонический формат не меняется', () => {
  assert.equal(normalizeReleaseDate('2026-07-25'), '2026-07-25')
})

test('A1: ISO-datetime обрезается до даты', () => {
  assert.equal(normalizeReleaseDate('2026-07-25T00:00:00.000Z'), '2026-07-25')
})

test('A1: пустые значения дают пустую строку', () => {
  assert.equal(normalizeReleaseDate(''), '')
  assert.equal(normalizeReleaseDate('   '), '')
  assert.equal(normalizeReleaseDate('--'), '')
  assert.equal(normalizeReleaseDate(null), '')
  assert.equal(normalizeReleaseDate(undefined), '')
})

test('A1: непарсящееся значение сохраняется как есть (не теряем ввод)', () => {
  assert.equal(normalizeReleaseDate('скоро'), 'скоро')
})

test('A1: нормализация не сдвигает день (сравнение по timestamp)', () => {
  for (const input of ['25.07.2026', '2026-07-25', '2026-07-25T12:34:56Z']) {
    const normalized = normalizeReleaseDate(input)
    assert.equal(
      parseReleaseDateToTimestamp(normalized),
      parseReleaseDateToTimestamp('2026-07-25'),
      `дата сдвинулась для ${input}`
    )
  }
})

test('A1: нормализованные даты корректно сортируются строкой', () => {
  const raw = ['05.01.2026', '2025-12-31', '31.12.2024', '2026-01-04']
  const sorted = raw.map(normalizeReleaseDate).sort()
  assert.deepEqual(sorted, ['2024-12-31', '2025-12-31', '2026-01-04', '2026-01-05'])
})
