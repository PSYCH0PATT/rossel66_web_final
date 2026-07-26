import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRubKpiShort, formatRubPlain } from './format-dashboard-rub'

test('C6: 1500 не округляется до «2K»', () => {
  assert.equal(formatRubKpiShort(1500), '1,5K')
  assert.equal(formatRubKpiShort(1000), '1K')
  assert.equal(formatRubKpiShort(1499), '1,5K')
  assert.equal(formatRubKpiShort(1049), '1K')
})

test('C6: отрицательные суммы видны, а не превращаются в 0', () => {
  assert.equal(formatRubKpiShort(-1500), '−1,5K')
  assert.equal(formatRubKpiShort(-250), '−250')
  // Intl использует неразрывный пробел как разделитель разрядов — нормализуем
  assert.equal(formatRubPlain(-1234.5).replace(/\s/g, ' '), '-1 234,5')
})

test('formatRubKpiShort: миллионы', () => {
  assert.equal(formatRubKpiShort(1_000_000), '1M')
  assert.equal(formatRubKpiShort(2_500_000), '2,5M')
})

test('formatRubKpiShort: мелкие суммы и нуль', () => {
  assert.equal(formatRubKpiShort(0), '0')
  assert.equal(formatRubKpiShort(999), '999')
})

test('нечисловые значения не роняют форматирование', () => {
  assert.equal(formatRubKpiShort(Number.NaN), '0')
  assert.equal(formatRubPlain(Number.POSITIVE_INFINITY), '0')
})
