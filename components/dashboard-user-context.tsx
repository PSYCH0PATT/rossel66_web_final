"use client"

import { createContext, useContext, type ReactNode } from "react"

/** Один из профилей артиста в переключателе (AKA). */
export type DashboardLinkedProfile = {
  id: string
  username: string
  name: string
  /** true — главный профиль группы, точка входа в кабинет. */
  isMain: boolean
}

export type DashboardProfile = {
  id: string
  username: string
  name: string
  avatarUrl: string | null
  role: "admin" | "artist"
  /** Артист, чей кабинет открыт сейчас. Совпадает с id, кроме просмотра привязанного профиля. */
  viewedArtistId?: string
  /**
   * Профили, доступные текущему пользователю: он сам и привязанные к нему.
   * Меньше двух — переключатель не показывается.
   */
  profiles?: DashboardLinkedProfile[]
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
