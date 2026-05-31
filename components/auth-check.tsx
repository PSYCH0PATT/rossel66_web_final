"use client"

import type React from "react"
import type { UserRole } from "@/lib/storage"

interface AuthCheckProps {
  children: React.ReactNode
  requiredRole?: UserRole
  username?: string
}

/**
 * @deprecated Auth is enforced in route layouts via cookie (`getSessionUser`).
 * This wrapper renders children immediately — no localStorage gate.
 */
export default function AuthCheck({ children }: AuthCheckProps) {
  return <>{children}</>
}
