import { notFound } from "next/navigation"

/**
 * Доступ к внутренним витринам `/dev/**`.
 *
 * `/dev/ui` показывает кит, `/dev/design-map` — карту фактического дизайна с
 * путями и номерами строк всего кабинета. На публичном домене им делать нечего.
 * До сих пор их не закрывало ничто: `middleware.ts` в проекте нет, гейта по
 * окружению тоже, а `robots: noindex` в метаданных закрывает индексацию, а не
 * доступ.
 *
 * Правило: в dev-сборке открыто всегда, в production-сборке — только по явному
 * `ENABLE_DEV_PAGES=1`. То есть на бою (Timeweb) закрыто по умолчанию, потому
 * что переменной там нет, а на стейдже открывается одной переменной в панели
 * Vercel — без правки кода и без отдельной ветки.
 *
 * Переменная намеренно без префикса `NEXT_PUBLIC_`: читается только на сервере
 * и в браузер не уезжает.
 */
export function devPagesEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true
  return process.env.ENABLE_DEV_PAGES === "1"
}

/** Отдаёт 404 вместо витрины, когда та закрыта. Зовётся из layout сегмента. */
export function requireDevPages(): void {
  if (!devPagesEnabled()) notFound()
}
