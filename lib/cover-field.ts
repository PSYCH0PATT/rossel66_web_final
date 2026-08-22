/**
 * Поле «Обложка (URL)» на карточке релиза (F-33).
 *
 * Часть обложек лежит в базе не ссылкой, а встроенным data-URI. В однострочном
 * инпуте это сотни символов base64: прочитать нельзя, отредактировать нельзя,
 * а случайная правка молча ломает картинку. Поэтому для встроенной обложки поле
 * показывает подпись и переходит в режим «только чтение» — заменить её можно
 * через «Загрузить обложку», настоящее значение при этом сохраняется как есть.
 */

export type CoverFieldKind = 'empty' | 'url' | 'embedded'

export interface CoverFieldView {
  kind: CoverFieldKind
  /** Что показать в инпуте. */
  value: string
  /** Настоящее значение поля — оно и уходит на сохранение. */
  rawValue: string
  readOnly: boolean
}

/** «2,9 КБ» / «1,0 МБ» / «300 Б» — по-русски, с запятой как разделителем. */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} КБ`
  return `${bytes} Б`
}

/** Размер данных из длины base64 с поправкой на паддинг. */
function base64Bytes(payload: string): number {
  const clean = payload.replace(/\s/g, '')
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

export function coverFieldView(raw: string | null | undefined): CoverFieldView {
  const value = (raw ?? '').trim()
  if (!value) return { kind: 'empty', value: '', rawValue: '', readOnly: false }

  const dataUri = value.match(/^data:([^;,]*)(;base64)?,(.*)$/is)
  if (!dataUri) return { kind: 'url', value, rawValue: value, readOnly: false }

  const mime = dataUri[1] || ''
  const isBase64 = Boolean(dataUri[2])
  const payload = dataUri[3] ?? ''
  const bytes = isBase64 ? base64Bytes(payload) : payload.length

  const subtype = mime.split('/')[1]?.toUpperCase()
  const details = [subtype, formatBytes(bytes)].filter(Boolean).join(', ')

  return {
    kind: 'embedded',
    value: `Встроенное изображение (${details})`,
    rawValue: value,
    readOnly: true,
  }
}
