import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reportFolderActions } from './report-folder'

/**
 * F-46 — папки «Q1 2026» и «Q4 2025» показывали «0 отчётов», но кнопки
 * «Скачать все» и «Удалить папку» оставались активными: скачивание отдавало
 * пустой архив, удаление предлагало подтвердить удаление ничего.
 */
test('F-46: у пустой папки действия недоступны', () => {
  const actions = reportFolderActions({ total: 0, loading: false })
  assert.equal(actions.isEmpty, true)
  assert.equal(actions.canDownloadAll, false)
  assert.equal(actions.canDeleteFolder, false)
  assert.equal(actions.disabledReason, 'В папке нет отчётов')
})

test('F-46: у непустой папки действия работают как раньше', () => {
  const actions = reportFolderActions({ total: 12, loading: false })
  assert.equal(actions.isEmpty, false)
  assert.equal(actions.canDownloadAll, true)
  assert.equal(actions.canDeleteFolder, true)
  assert.equal(actions.disabledReason, null)
})

test('F-46: пока папка грузится, счётчик ещё неизвестен — действий не даём', () => {
  const actions = reportFolderActions({ total: 0, loading: true })
  assert.equal(actions.canDownloadAll, false)
  assert.equal(actions.canDeleteFolder, false)
  assert.equal(actions.disabledReason, 'Папка ещё загружается')
  // Уже известное содержимое загрузку переживает.
  assert.equal(reportFolderActions({ total: 3, loading: true }).canDownloadAll, true)
})
