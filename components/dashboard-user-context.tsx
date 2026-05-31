"use client"

import { createContext, useContext, type ReactNode } from "react"

export type DashboardProfile = {
  id: string
  username: string
  name: string
  avatarUrl: string | null
  role: "admin" | "artist"
}

const DashboardUserContext = createContext<DashboardProfile | null>(null)

export function DashboardUserProvider({
  profile,
  children,
}: {
  profile: DashboardProfile
  children: ReactNode
}) {
  return (
    <DashboardUserContext.Provider value={profile}>{children}</DashboardUserContext.Provider>
  )
}

export function useDashboardProfile(): DashboardProfile | null {
  return useContext(DashboardUserContext)
}
