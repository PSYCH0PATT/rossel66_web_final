"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import Sidebar from "./sidebar"
import TopNav from "./top-nav"
import type { UserRole } from "@/lib/storage"
import { DashboardUserProvider, type DashboardProfile } from "./dashboard-user-context"

interface DashboardShellProps {
  children: ReactNode
  role: UserRole
  requiredRole?: UserRole
  username?: string
  profile: DashboardProfile
}

/** Persistent dashboard chrome (sidebar + top nav). Mount from route layout only. */
export default function DashboardShell({
  children,
  role,
  requiredRole,
  username,
  profile,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <DashboardUserProvider profile={profile}>
      <div className="relative z-10 flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden text-gray-100 md:h-screen md:max-h-none md:flex-row">
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
        <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-7xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] md:p-10 md:pb-12">
            {children}
          </div>
        </main>
      </div>
    </DashboardUserProvider>
  )
}
