/**
 * Действия над папкой отчётов (квартал + год) — F-46.
 *
 * У папки с «0 отчётов» «Скачать все» отдавало пустой архив, а «Удалить папку»
 * спрашивало подтверждение на удаление ничего. Действие, которому не над чем
 * работать, должно быть выключено, а не «сработать вхолостую».
 */

export interface ReportFolderState {
  /** Сколько отчётов в папке по данным сервера. */
  total: number
  /** Содержимое папки ещё грузится (счётчик неизвестен). */
  loading?: boolean
}

export interface ReportFolderActions {
  isEmpty: boolean
  canDownloadAll: boolean
  canDeleteFolder: boolean
  /** Подпись для title/tooltip выключенной кнопки; null — когда кнопки активны. */
  disabledReason: string | null
}

export function reportFolderActions({ total, loading = false }: ReportFolderState): ReportFolderActions {
  const isEmpty = !(total > 0)
  const enabled = total > 0

  let disabledReason: string | null = null
  if (!enabled) disabledReason = loading ? 'Папка ещё загружается' : 'В папке нет отчётов'

  return {
    isEmpty,
    canDownloadAll: enabled,
    canDeleteFolder: enabled,
    disabledReason,
  }
}
