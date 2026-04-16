"use client"

import type { ReactNode } from "react"
import Sidebar from "./sidebar"
import TopNav from "./top-nav"
import type { UserRole } from "@/lib/data"
import AuthCheck from "./auth-check"

interface LayoutProps {
  children: ReactNode
  role: UserRole
  requiredRole?: UserRole
  username?: string
}

export default function Layout({ children, role, requiredRole, username }: LayoutProps) {
  return (
    <AuthCheck requiredRole={requiredRole} username={username}>
      <div className="relative z-10 flex flex-col md:flex-row h-screen overflow-hidden text-gray-100">
        <Sidebar role={role} username={username} />
        {/* TopNav is mobile only, Sidebar acts as desktop nav. See TopNav component. */}
        <TopNav role={role} username={username} />
        <main className="flex-1 overflow-y-auto relative">
          <div className="mx-auto max-w-7xl p-6 pb-20 md:p-10 md:pb-24">
            {children}
          </div>
        </main>
      </div>
    </AuthCheck>
  )
}
