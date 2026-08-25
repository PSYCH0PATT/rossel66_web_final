"use client"

import type React from "react"

import { useEffect, useMemo, memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useDashboardProfile } from "@/components/dashboard-user-context"
import { dashboardLogout } from "@/lib/dashboard-logout"
import { dashboardNavRole, isNavItemActive } from "@/lib/dashboard-nav"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
interface SidebarProps {
  role: "artist" | "admin"
  username?: string
  mobileMenuOpen: boolean
  onMobileMenuOpenChange: (open: boolean) => void
}

type NavItemConfig = { href: string; label: string }

const SidebarNavItem = memo(function SidebarNavItem({
  item,
  pathname,
  navHrefs,
  onNavigate,
}: {
  item: NavItemConfig
  pathname: string
  navHrefs: readonly string[]
  onNavigate: () => void
}) {
  // F-56: строгое равенство гасило подсветку на любой вложенной странице
  const isActive = isNavItemActive(pathname, item.href, navHrefs)
  let iconName = ""
  switch (item.label) {
    case "Главная":
      iconName = "dashboard"
      break
    case "Релизы":
      iconName = "library_music"
      break
    case "Отчёты":
      iconName = "analytics"
      break
    case "Отчёты и выплаты":
      // Экран прежде всего про отчёты; «analytics» тут был бы вторым таким же
      // значком рядом с «Аналитикой».
      iconName = "receipt_long"
      break
    case "Выплаты":
      iconName = "account_balance_wallet"
      break
    case "Плейлисты":
      iconName = "queue_music"
      break
    case "Артисты":
      iconName = "groups"
      break
    case "История плейлистов":
      iconName = "history"
      break
    case "Аналитика":
      iconName = "insights"
      break
    case "Активность":
      iconName = "local_activity"
      break
    default:
      iconName = "circle"
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center p-3 rounded-lg transition-all group ${
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-gray-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <span
        className={`material-symbols-outlined ${isActive ? "" : "group-hover:text-primary transition-colors"}`}
      >
        {iconName}
      </span>
      <span className="ml-4 font-medium tracking-wide text-sm">{item.label}</span>
    </Link>
  )
})

/** Шапка сайдбара: логотип и — в мобильном drawer'е — крестик закрытия. */
function SidebarLogoBar({
  homeHref,
  onNavigate,
  onClose,
}: {
  homeHref: string
  onNavigate: () => void
  onClose?: () => void
}) {
  return (
    <div className="flex h-16 min-h-16 shrink-0 items-center border-b border-white/5 px-2 lg:px-6">
      <Link
        href={homeHref}
        onClick={onNavigate}
        aria-label="На главную дашборда"
        className="flex h-full min-h-11 min-w-0 flex-1 items-center justify-center px-2"
      >
        <img
          src="/images/logo.png"
          alt=""
          className="h-7 w-auto max-h-7 shrink-0 object-contain"
        />
      </Link>
      {onClose && (
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 tap-highlight-transparent hover:bg-white/5 hover:text-white [-webkit-tap-highlight-color:transparent]"
          onClick={onClose}
          aria-label="Закрыть меню"
        >
          <span className="material-symbols-outlined text-2xl leading-none">close</span>
        </button>
      )}
    </div>
  )
}

/** Список разделов. В drawer'е заголовок группы служит заголовком диалога. */
function SidebarNav({
  role,
  navItems,
  pathname,
  onNavigate,
  titleAs: Title = "div",
}: {
  role: "artist" | "admin"
  navItems: NavItemConfig[]
  pathname: string
  onNavigate: () => void
  titleAs?: React.ElementType
}) {
  const navHrefs = navItems.map((item) => item.href)
  return (
    <nav className="mt-6 px-2 lg:mt-8 lg:px-4 space-y-1">
      <Title className="px-3 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
        {role === "artist" ? "Кабинет артиста" : "Панель управления"}
      </Title>
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          item={item}
          pathname={pathname}
          navHrefs={navHrefs}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

/** Профиль и выход — нижний блок, который на 390 был недостижим (F-75). */
function SidebarUserBlock({
  role,
  currentUsername,
  settingsHref,
  onNavigate,
  onLogout,
}: {
  role: "artist" | "admin"
  currentUsername: string
  settingsHref: string
  onNavigate: () => void
  onLogout: () => void
}) {
  return (
    <div className="p-6 border-t border-white/5">
      <Link
        href={settingsHref}
        onClick={onNavigate}
        title="Настройки"
        className="group/profile mb-2 flex cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 transition-colors hover:border-white/10"
      >
        <div className="flex items-center overflow-hidden">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 border border-primary/50 text-white font-bold">
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{currentUsername || "User"}</p>
            <p className="text-[10px] text-primary uppercase tracking-widest">{role === "artist" ? "Артист" : "Админ"}</p>
          </div>
        </div>
        {/*
          F-94: блок профиля — единственный вход в настройки на десктопе, и
          выглядел он подписью, а не кнопкой: ни стрелки, ни намёка на переход.
          Пункт в навигацию не добавляем (экран редкий) — даём аффорданс.
          Стрелка без подписи намеренно: слово «Настройки» рядом с именем и
          ролью съедало их до «e2e… / АРТИС» на сайдбаре шириной 256px.
        */}
        <span className="ml-2 shrink-0 text-gray-500 transition-colors group-hover/profile:text-primary">
          <span className="sr-only">Настройки</span>
          <span className="material-symbols-outlined text-xl leading-none" aria-hidden>
            chevron_right
          </span>
        </span>
      </Link>
      <button
        onClick={onLogout}
        className="w-full flex items-center p-3 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all group"
      >
        <span className="material-symbols-outlined group-hover:text-red-400 transition-colors">logout</span>
        <span className="ml-4 font-medium tracking-wide text-sm">Выйти</span>
      </button>
    </div>
  )
}

export default function Sidebar({ role, username, mobileMenuOpen, onMobileMenuOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useDashboardProfile()
  const currentUsername = username || profile?.username || ""

  useEffect(() => {
    onMobileMenuOpenChange(false)
  }, [pathname, onMobileMenuOpenChange])

  function handleNavigation() {
    onMobileMenuOpenChange(false)
  }

  function handleLogout() {
    void dashboardLogout(router)
  }

  // Создаем базовые пути для артиста с учетом username
  const artistBasePath = `/dashboard/artist/${currentUsername}`

  const artistNavItems: NavItemConfig[] = useMemo(
    () => [
      // Порядок = приоритету владельца (docs/ia-decisions.md, §3): аналитика
      // первым содержательным разделом, дальше релизы → отчёты → плейлисты.
      // 0-а (артистская половина, Б-16): «Отчёты» и «Выплаты» были двумя
      // пунктами про одни деньги — стали одним, роут /payments остался
      // редиректом. Слово «выплаты» из подписи не убрано намеренно: артист
      // пользовался этим пунктом, и его исчезновение читалось бы как «выплаты
      // убрали», а не «переехали».
      { href: `${artistBasePath}/dashboard`, label: "Главная" },
      { href: `${artistBasePath}/analytics`, label: "Аналитика" },
      { href: `${artistBasePath}/releases`, label: "Релизы" },
      { href: `${artistBasePath}/reports`, label: "Отчёты и выплаты" },
      { href: `${artistBasePath}/playlists`, label: "Плейлисты" },
    ],
    [artistBasePath]
  )

  const adminNavItems: NavItemConfig[] = useMemo(
    () => [
      { href: "/dashboard/admin/dashboard", label: "Главная" },
      { href: "/dashboard/admin/artists", label: "Артисты" },
      { href: "/dashboard/admin/releases", label: "Релизы" },
      // 0-а и ответ №3 (docs/ia-decisions.md): «Выплаты» и «Генератор отчётов»
      // стали видами объединённого экрана «Отчёты» — отдельных пунктов у них
      // больше нет, роуты остались редиректами ради закладок.
      { href: "/dashboard/admin/reports", label: "Отчёты" },
      // 0-в п.3: у сервисных экранов нет самостоятельных входов — «История
      // плейлистов» достижима ghost-ссылкой из тулбара самих плейлистов.
      { href: "/dashboard/admin/playlists", label: "Плейлисты" },
      { href: "/dashboard/admin/analytics", label: "Аналитика" },
      { href: "/dashboard/admin/activity", label: "Активность" },
    ],
    []
  )

  /**
   * F-56: пункты и «домой» задаёт кабинет, в котором мы находимся, — иначе
   * админ, открывший кабинет артиста, получал админское меню и не мог
   * пройти по разделам кабинета. Нижний блок остаётся про саму сессию:
   * это профиль вошедшего, и настройки у него свои.
   */
  const navRole = dashboardNavRole({ sessionRole: role, pathname })
  const navItems = navRole === "artist" ? artistNavItems : adminNavItems
  const homeHref = navRole === "artist" ? `${artistBasePath}/dashboard` : "/dashboard/admin/dashboard"
  const settingsHref = role === "artist" ? `${artistBasePath}/settings` : "/dashboard/admin/settings"

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-64 flex-shrink-0 flex-col justify-between border-r border-white/5 bg-black/60 glass-panel backdrop-blur-xl md:flex">
        <div>
          <SidebarLogoBar homeHref={homeHref} onNavigate={handleNavigation} />
          <SidebarNav
            role={navRole}
            navItems={navItems}
            pathname={pathname}
            onNavigate={handleNavigation}
          />
        </div>
        <SidebarUserBlock
          role={role}
          currentUsername={currentUsername}
          settingsHref={settingsHref}
          onNavigate={handleNavigation}
          onLogout={handleLogout}
        />
      </aside>

      {/*
        Мобильный drawer — C-12 (F-75): у самописного `aside fixed h-full`
        содержимое не скроллилось, и на 390 нижний блок с «Выйти» был
        недостижим. Sheet даёт трап фокуса и Esc, ScrollArea — скролл списка;
        z-стек прежний: панель над шапкой (z-110), подложка под ней (z-100),
        поэтому бургер остаётся виден и закрывает меню повторным нажатием.
      */}
      <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuOpenChange}>
        <SheetContent
          side="left"
          showClose={false}
          overlayClassName="z-[100] top-[calc(4rem+env(safe-area-inset-top,0px))]"
          aria-describedby={undefined}
          className="z-[110] w-64 gap-0 border-r border-white/5 bg-black/70 p-0 pb-[env(safe-area-inset-bottom,0px)] pt-[max(0px,env(safe-area-inset-top,0px))] glass-panel backdrop-blur-xl sm:max-w-none md:hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <SidebarLogoBar
              homeHref={homeHref}
              onNavigate={handleNavigation}
              onClose={() => onMobileMenuOpenChange(false)}
            />
            <ScrollArea className="flex-1" fadeClassName="from-black/70">
              <SidebarNav
                role={navRole}
                navItems={navItems}
                pathname={pathname}
                onNavigate={handleNavigation}
                titleAs={SheetTitle}
              />
            </ScrollArea>
          </div>
          <SidebarUserBlock
            role={role}
            currentUsername={currentUsername}
            settingsHref={settingsHref}
            onNavigate={handleNavigation}
            onLogout={handleLogout}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
