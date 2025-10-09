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
    <div className="dashboard-theme">
      {children}
    </div>
  )
}

