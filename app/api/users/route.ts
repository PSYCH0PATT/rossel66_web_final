import { NextResponse } from "next/server"
import { loadUsers } from "@/lib/storage"

export async function GET() {
  try {
    const users = await loadUsers()
    
    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        // password НЕ возвращаем - используйте /api/auth/login для аутентификации
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        vkMusicUrl: user.vkMusicUrl,
        yandexMusicUrl: user.yandexMusicUrl,
        spotifyUrl: user.spotifyUrl,
      }))
    })
  } catch (error) {
    console.error("Error loading users:", error)
    return NextResponse.json(
      { error: "Error loading users" },
      { status: 500 }
    )
  }
}





