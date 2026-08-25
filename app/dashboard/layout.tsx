"use client"

import "./dashboard.css"
import { usePathname } from "next/navigation"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/dashboard/login"

  // Не применяем dashboard-theme на странице логина
  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="dashboard-theme relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden text-gray-100 transition-colors duration-300 md:h-screen md:max-h-none">
      <div className="noise-overlay"></div>
      {/*
        Фон и его анимация — как задумано, на всех экранах (решение владельца).
        Единственное ограничение — motion-safe: если пользователь на уровне ОС
        попросил уменьшить движение, анимация не проигрывается. Размытие
        blur-[150px] оставлено прежним: на 60px мягкое свечение превращается
        в резкое цветное пятно.
      */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/*
          opacity-[0.55] — базовая прозрачность под `prefers-reduced-motion`.
          У блоба её не было, и без анимации он вставал на opacity: 1, тогда
          как кейфреймы гоняют его между 0.4 и 0.7 (tailwind.config.js). То
          есть пользователь, попросивший уменьшить движение, получал верхний
          левый угол вдвое ярче задуманного, а серые подписи поверх него
          («Общее число стримов», subtitle шапки) переставали читаться.
          Анимация перебивает это значение, когда движение разрешено.
        */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-azure blur-[150px] opacity-[0.55] motion-safe:animate-pulse-slow-azure-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent-emerald blur-[150px] opacity-[0.1]"></div>
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-purple-900 blur-[150px] opacity-[0.05]"></div>
      </div>
      <div className="fixed inset-0 z-0 grid-bg pointer-events-none opacity-40"></div>
      {children}
    </div>
  )
}

