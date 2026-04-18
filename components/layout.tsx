"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import Sidebar from "./sidebar"
import TopNav from "./top-nav"
import type { UserRole } from "@/lib/storage"
import AuthCheck from "./auth-check"

interface LayoutProps {
  children: ReactNode
  role: UserRole
  requiredRole?: UserRole
  username?: string
}

export default function Layout({ children, role, requiredRole, username }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <AuthCheck requiredRole={requiredRole} username={username}>
      <div className="relative z-10 flex h-[100dvh] flex-col overflow-hidden text-gray-100 md:h-screen md:flex-row">
        <Sidebar
          role={role}
          username={username}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuOpenChange={setMobileMenuOpen}
        />
        <TopNav
          role={role}
          username={username}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)}
        />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-6 pb-20 md:p-10 md:pb-24">
            {children}
          </div>
        </main>
      </div>
    </AuthCheck>
  )
}
