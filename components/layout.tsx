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
      <div className="flex h-screen">
        <Sidebar role={role} username={username} />
        <div className="w-full flex flex-1 flex-col">
          <header className="h-16 border-b border-gray-700 flex-shrink-0">
            <TopNav role={role} username={username} />
          </header>
          <main className="flex-1 scroll-container bg-background">
            <div className="p-6 pb-12">{children}</div>
          </main>
        </div>
      </div>
    </AuthCheck>
  )
}
