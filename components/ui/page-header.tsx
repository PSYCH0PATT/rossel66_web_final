import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

/**
 * Единая шапка страницы кабинета — C-01 (docs/ui-audit.md).
 *
 * Паттерн «h1 + subtitle + border-b + actions» скопипащен в ~34 экранах в
 * 7 вариантах; этот компонент — их общий знаменатель.
 *
 * Размер H1 один на весь кабинет и задаётся здесь — снаружи его передать
 * нечем. Проп `size` был удалён намеренно: волны 1–4 пересадили страницы на
 * компонент, но `size="md"` на 11 экранах против `lg` на 18 оставил заголовки
 * трёх разных размеров. Нужен другой размер — правится эта строка, а не
 * страница.
 *
 * Ширину и поля страницы задаёт DashboardShell (`mx-auto max-w-7xl p-6
 * md:p-10`), поэтому вертикальный отступ шапки (`pb-8`) тоже живёт здесь:
 * `className` идёт через twMerge и внешний `pb-6` молча перебивал канон.
 * Адаптив заголовка (мобила/планшет/десктоп) — тоже здесь, см. TITLE_CLASS:
 * в глобальном CSS размера H1 больше нет (B-09).
 *
 * Правило: H1 = имя сущности («МЕЛАНХОЛИЯ»), а не действие
 * («РЕДАКТИРОВАНИЕ») — действие живёт в subtitle или кнопке (F-24).
 * Слот actions держит primary-кнопку в одном месте на всех экранах (F-32).
 * Возврат на уровень выше — `backHref`/`breadcrumbs` внутри шапки, а не
 * отдельной кнопкой над ней.
 * Экран логина (группа G) остаётся автономным исключением — без PageHeader.
 */

export interface PageHeaderCrumb {
  label: React.ReactNode
  /** Без href крошка считается текущей страницей. */
  href?: string
}

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Короткая крошка-возврат «← К списку». Взаимоисключима с breadcrumbs. */
  backHref?: string
  backLabel?: React.ReactNode
  /** Полные крошки; последняя без href рендерится текущей страницей (F-51: крошка = H1). */
  breadcrumbs?: PageHeaderCrumb[]
  /** Слот действий справа от заголовка (primary — здесь, не внизу экрана). */
  actions?: React.ReactNode
  /**
   * Бейдж вплотную к H1 — статус самой сущности, а не действие. На карте
   * релиза он висел на линии subtitle в слоте actions и не читался как
   * свойство релиза (вердикт 3.4, блок 1).
   */
  titleBadge?: React.ReactNode
  /**
   * `section` (по умолчанию) — имя раздела дисплейным капсом.
   * `entity` — имя сущности как его написал человек: Syncopate не знает
   * строчных и буквы «ё», и «Я всё ещё одна» превращалось в «я все еще одна»
   * (F-52). Кегль и ритм канона в обоих случаях одни и те же.
   */
  titleStyle?: "section" | "entity"
  /**
   * Слот под заголовком: подписи и служебные действия, привязанные к H1
   * (ряд «Синхронизировать / Загрузить CSV / Сопоставить» в аналитике).
   */
  meta?: React.ReactNode
  /** Классы ряда «заголовок ↔ действия»: другая точка слома или выравнивание. */
  rowClassName?: string
  /** Классы слота действий: например, фильтры на всю ширину мобильного экрана. */
  actionsClassName?: string
}

/**
 * Классы H1 — намеренно готовые строки, а НЕ cn(): tailwind-merge 2.1 не знает
 * утилит переноса из Tailwind 3.4 и относит `text-balance` к группе цвета
 * текста, поэтому его молча съедает идущий следом `text-white` — даже внутри
 * одного аргумента. Пока строка шла через cn(), `text-balance` не доезжал до
 * разметки вовсе, и фикс F-83 («РЕДАКТИРОВАНИ / Е» на 390) в бою не работал.
 * Проверить: twMerge("text-balance …text-white") вернёт строку без text-balance.
 * Сторож — components/ui/cn-merge.test.ts (B-11).
 *
 * Кегль у обоих вариантов один и тот же — различаются только шрифт и регистр,
 * поэтому канон C-01 (одна высота и один размер заголовка на всех экранах)
 * не задет.
 *
 * Адаптив тоже здесь и только здесь (B-09): раньше размер на узких экранах
 * перебивали два медиазапроса `.dashboard-theme h1` в dashboard.css, и
 * источников размера было два. Ступени сохранены один в один:
 *   ≥1024      — text-5xl (3rem, line-height 1);
 *   641…1023   — clamp(1.75rem, 4.5vw, 3rem): с md сайдбар забирает 256px,
 *                контент уже, а заголовок иначе рос бы до 3rem и обрезался;
 *   ≤640       — clamp(1.5rem, 7.5vw, 2.25rem).
 * Ниже 1024 добавляются line-height 1.1 и `overflow-wrap: anywhere` — страховка
 * от длинного слова без пробелов. Оба порога — произвольные `max-[…]`, а не
 * `sm:`/`lg:`: они идут через один вариант Tailwind и гарантированно сортируются
 * по убыванию, тогда как смесь именованного и произвольного брейкпоинта зависит
 * от порядка медиазапросов. `length:` — подсказка типа, без неё clamp() можно
 * принять за цвет.
 */
const TITLE_ADAPTIVE =
  "max-[1023px]:text-[length:clamp(1.75rem,4.5vw,3rem)] max-[1023px]:leading-[1.1] " +
  "max-[1023px]:[overflow-wrap:anywhere] max-[640px]:text-[length:clamp(1.5rem,7.5vw,2.25rem)]"

const TITLE_CLASS = {
  section:
    "text-balance font-display text-5xl font-bold uppercase tracking-tight text-white " +
    TITLE_ADAPTIVE,
  entity: "text-balance text-5xl font-bold tracking-tight text-white " + TITLE_ADAPTIVE,
} as const

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  (
    {
      title,
      subtitle,
      backHref,
      backLabel = "К списку",
      breadcrumbs,
      actions,
      titleBadge,
      titleStyle = "section",
      meta,
      rowClassName,
      actionsClassName,
      className,
      ...props
    },
    ref
  ) => (
    <header
      ref={ref}
      className={cn(
        "border-b border-white/5",
        className,
        // Вертикальный ритм идёт ПОСЛЕ className намеренно: cn() это twMerge,
        // побеждает последний класс. Внешние `pb-6`/`mb-8` больше не сдвигают
        // шапку — отступ до контента задаёт `space-y-8` корня страницы.
        "mb-0 pb-8"
      )}
      {...props}
    >
      {backHref && !breadcrumbs && (
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-11 items-center gap-2 font-mono text-xs uppercase tracking-widest text-gray-500 transition-colors hover:text-primary md:min-h-0"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            arrow_back
          </span>
          {backLabel}
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div
        className={cn(
          "flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between md:gap-6",
          rowClassName
        )}
      >
        <div className="min-w-0">
          {titleBadge ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className={TITLE_CLASS[titleStyle]}>{title}</h1>
              {titleBadge}
            </div>
          ) : (
            <h1 className={TITLE_CLASS[titleStyle]}>{title}</h1>
          )}
          {subtitle && (
            <p className="mt-2 max-w-md text-sm font-light text-gray-400">
              {subtitle}
            </p>
          )}
          {meta}
        </div>
        {actions && (
          <div className={cn("flex shrink-0 flex-wrap items-center gap-3", actionsClassName)}>
            {actions}
          </div>
        )}
      </div>
    </header>
  )
)
PageHeader.displayName = "PageHeader"

export { PageHeader }
