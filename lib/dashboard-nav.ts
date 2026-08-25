/**
 * Навигация кабинета: чей это сайдбар и какой пункт активен (F-56).
 *
 * Админ, зашедший в кабинет артиста, видел админский сайдбар с админскими
 * разделами — из кабинета артиста нельзя было вернуться в него же. Набор
 * пунктов определяет КАБИНЕТ (адрес), а не роль сессии; права при этом не
 * меняются — их по-прежнему проверяют layout и API.
 *
 * Второй симптом — «активный пункт не подсвечен»: сравнение шло строгим
 * равенством pathname и href, поэтому любая вложенная страница (карточка
 * релиза, плейлист) гасила подсветку раздела.
 */

export type DashboardNavRole = 'artist' | 'admin'

export function dashboardNavRole({
  sessionRole,
  pathname,
}: {
  sessionRole: DashboardNavRole
  pathname: string
}): DashboardNavRole {
  if (pathname.startsWith('/dashboard/artist/')) return 'artist'
  if (pathname.startsWith('/dashboard/admin')) return 'admin'
  return sessionRole
}

/** Совпадает ли адрес с разделом: сам раздел или страница внутри него. */
function matchesSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Экраны без своего пункта меню и их родитель (F-90).
 *
 * «Активность» артиста — намеренный orphan: пункта в навигации у неё нет и не
 * нужно, вход только по ссылке «Все события» с главной (ответ владельца №8).
 * Но при открытом /activity не подсвечивался вообще ни один пункт, и кабинет
 * выглядел «нигде». Родителем считаем тот раздел, откуда ведёт единственный
 * вход, — «Главную».
 */
const ORPHAN_PARENTS: ReadonlyArray<{ suffix: string; parent: string }> = [
  { suffix: '/activity', parent: '/dashboard' },
]

/** Адрес, по которому решается подсветка: у orphan-экрана — его родитель. */
function navPathname(pathname: string): string {
  for (const { suffix, parent } of ORPHAN_PARENTS) {
    if (pathname.startsWith('/dashboard/artist/') && pathname.endsWith(suffix)) {
      return pathname.slice(0, -suffix.length) + parent
    }
  }
  return pathname
}

/**
 * Активен ли пункт навигации. При вложенных разделах (`/playlists` и
 * `/playlists/history`) выигрывает самый длинный совпавший href — подсвечен
 * всегда ровно один пункт.
 */
export function isNavItemActive(pathname: string, href: string, allHrefs: readonly string[]): boolean {
  const target = navPathname(pathname)
  if (!matchesSection(target, href)) return false

  const longest = allHrefs
    .filter((candidate) => matchesSection(target, candidate))
    .reduce((best, candidate) => (candidate.length > best.length ? candidate : best), '')

  return longest === href
}
