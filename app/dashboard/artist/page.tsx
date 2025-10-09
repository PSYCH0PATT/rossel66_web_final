"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ArtistRedirect() {
  const router = useRouter()

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        if (user.role === "artist") {
          router.push(`/artist/${user.username}/dashboard`)
        } else {
          router.push("/admin/dashboard")
        }
      } catch (error) {
        router.push("/login")
      }
    } else {
      router.push("/login")
    }
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-azure"></div>
    </div>
  )
}
