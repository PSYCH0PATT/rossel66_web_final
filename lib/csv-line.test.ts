import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsvLine, splitCsvLines } from './csv-line'

test('parseCsvLine: обычная строка', () => {
  assert.deepEqual(parseCsvLine('a;b;c'), ['a', 'b', 'c'])
})

test('parseCsvLine: разделитель внутри кавычек не режет поле', () => {
  assert.deepEqual(parseCsvLine('"Рок; и роллы";b'), ['Рок; и роллы', 'b'])
})

test('F-PARS-14: экранированная "" больше не сдвигает колонки', () => {
  // Старый парсер плейлистов просто переключал флаг на каждой кавычке,
  // из-за чего последующие поля разъезжались.
  assert.deepEqual(parseCsvLine('"Best of ""Rock""";позиция;url'), [
    'Best of "Rock"',
    'позиция',
    'url',
  ])
})

test('parseCsvLine: пустые поля сохраняются', () => {
  assert.deepEqual(parseCsvLine('a;;c'), ['a', '', 'c'])
  assert.deepEqual(parseCsvLine(''), [''])
})

test('parseCsvLine: пробелы вокруг значений срезаются', () => {
  assert.deepEqual(parseCsvLine('  a  ;  b  '), ['a', 'b'])
})

test('F-PARS-14: BOM срезается (иначе первое поле заголовка не находилось)', () => {
  const lines = splitCsvLines('﻿date;dsp\n2026-01-01;vk')
  assert.deepEqual(parseCsvLine(lines[0]), ['date', 'dsp'])
})

test('F-PARS-14: CRLF не оставляет \\r в последнем поле', () => {
  const lines = splitCsvLines('a;b\r\nc;d\r\n')
  assert.deepEqual(lines, ['a;b', 'c;d'])
  assert.deepEqual(parseCsvLine(lines[0]), ['a', 'b'])
})

test('splitCsvLines: пустые строки отбрасываются', () => {
  assert.deepEqual(splitCsvLines('a\n\n\nb\n   \n'), ['a', 'b'])
})
