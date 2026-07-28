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
        DS5: главный источник джанка при прокрутке на мобильном — не сам блюр,
        а БЕСКОНЕЧНАЯ анимация поверх размытого fixed-слоя: каждый кадр заставлял
        перерисовывать blur-[150px]. Радиус оставляем как был (иначе мягкое
        фоновое свечение превращается в резкое цветное пятно), а анимацию
        включаем только с md и только если пользователь не просил уменьшить
        движение (motion-safe).
      */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent-azure blur-[150px] md:motion-safe:animate-pulse-slow-azure-blob"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent-emerald blur-[150px] opacity-[0.1]"></div>
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] rounded-full bg-purple-900 blur-[150px] opacity-[0.05]"></div>
      </div>
      <div className="fixed inset-0 z-0 grid-bg pointer-events-none opacity-40"></div>
      {children}
    </div>
  )
}

