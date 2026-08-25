import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coverFieldView } from './cover-field'

/**
 * F-33 — поле «Обложка (URL)» на карточке релиза показывало сырой data-URI
 * («data:image/jpeg;base64,/9j/4AAQ…») на сотни символов в однострочном инпуте:
 * отредактировать нельзя, прочитать нельзя, случайная правка ломает картинку.
 * Показываем, что обложка встроенная, а не её байты.
 */
test('F-33: base64-обложка показывается подписью, а не сырыми байтами', () => {
  const raw = `data:image/jpeg;base64,${'A'.repeat(4000)}`
  const view = coverFieldView(raw)

  assert.equal(view.kind, 'embedded')
  assert.equal(view.readOnly, true)
  assert.equal(view.value, 'Встроенное изображение (JPEG, 2,9 КБ)')
  // Сырых байтов в поле не остаётся ни в каком виде.
  assert.ok(!view.value.includes('base64'))
  assert.ok(!view.value.includes('AAAA'))
  // Настоящее значение никуда не делось — оно уходит на сохранение как было.
  assert.equal(view.rawValue, raw)
})

test('F-33: обычный URL остаётся редактируемым и не подменяется', () => {
  const view = coverFieldView('https://cdn.example.com/cover.jpg')
  assert.equal(view.kind, 'url')
  assert.equal(view.readOnly, false)
  assert.equal(view.value, 'https://cdn.example.com/cover.jpg')
})

test('F-33: пустое поле остаётся пустым', () => {
  for (const empty of [null, undefined, '', '   ']) {
    const view = coverFieldView(empty)
    assert.equal(view.kind, 'empty')
    assert.equal(view.readOnly, false)
    assert.equal(view.value, '')
  }
})

test('F-33: тип и размер берутся из самого data-URI', () => {
  assert.equal(
    coverFieldView(`data:image/png;base64,${'A'.repeat(1_400_000)}`).value,
    'Встроенное изображение (PNG, 1,0 МБ)'
  )
  // Без указания типа — нейтральная подпись, без «undefined».
  assert.equal(
    coverFieldView(`data:;base64,${'A'.repeat(400)}`).value,
    'Встроенное изображение (300 Б)'
  )
})
