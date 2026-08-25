/**
 * Сколько заглушек-карточек рисовать на время загрузки списка (F-86).
 *
 * На 390 при скролле попадался целый вьюпорт пустого фона: экран на время
 * запроса схлопывался в один спиннер (а сетка плейлистов не рисовала вообще
 * ничего), потом карточки «всплывали» и страница прыгала. Заглушки держат
 * ровно то место, которое займут карточки, — столько, сколько их придёт.
 */

export interface ListSkeletonOptions {
  /** Размер страницы выдачи. */
  pageSize: number
  /** Сколько всего записей, если сервер уже это сказал. */
  total?: number | null
  /** Номер текущей страницы (с 1). */
  page?: number
  /** Сколько карточек показывалось до этой загрузки. */
  previousCount?: number | null
  /** Потолок: длиннее пары вьюпортов заглушек не рисуем. */
  max?: number
}

export function listSkeletonCount({
  pageSize,
  total,
  page = 1,
  previousCount,
  max = 24,
}: ListSkeletonOptions): number {
  let expected: number

  if (typeof total === 'number') {
    expected = Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize))
  } else if (typeof previousCount === 'number') {
    expected = previousCount
  } else {
    expected = pageSize
  }

  return Math.max(0, Math.min(expected, max))
}
