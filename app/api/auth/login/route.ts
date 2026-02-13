import { NextResponse } from "next/server"
import { loadUsers } from "@/lib/storage"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Логин и пароль обязательны" },
        { status: 400 }
      )
    }

    let users
    try {
      users = await loadUsers()
    } catch (err) {
      console.error("Login: не удалось загрузить пользователей (проверьте DATABASE_URL):", err)
      return NextResponse.json(
        { success: false, error: "Ошибка сервера. Проверьте подключение к базе данных." },
        { status: 500 }
      )
    }

    const user = users.find(u => u.username === username)

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Неверный логин или пароль" },
        { status: 401 }
      )
    }

    // Проверяем пароль
    let isValidPassword = false
    
    // Проверяем, захеширован ли пароль (bcrypt хеши начинаются с $2)
    if (user.password.startsWith('$2')) {
      // Пароль захеширован - сравниваем через bcrypt
      isValidPassword = await bcrypt.compare(password, user.password)
    } else {
      // Пароль в plaintext (для обратной совместимости)
      // После миграции этот блок можно удалить
      isValidPassword = user.password === password
    }

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Неверный логин или пароль" },
        { status: 401 }
      )
    }

    // Возвращаем данные пользователя БЕЗ пароля
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        vkMusicUrl: user.vkMusicUrl,
        yandexMusicUrl: user.yandexMusicUrl,
        spotifyUrl: user.spotifyUrl,
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500 }
    )
  }
}
