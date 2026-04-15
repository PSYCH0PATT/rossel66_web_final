import { NextResponse } from "next/server"
import { getUserByUsername } from "@/lib/storage"
import { buildSessionCookieValue } from "@/lib/server-auth"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  const debugStart = performance.now()
  const debugLog = (phase: string, start: number) => {
    const ms = Math.round(performance.now() - start)
    console.log(`[LOGIN_DEBUG] ${phase}: ${ms}ms`)
  }

  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Логин и пароль обязательны" },
        { status: 400 }
      )
    }

    const tLoadUser = performance.now()
    let user
    try {
      user = await getUserByUsername(username)
      debugLog("getUserByUsername (DB)", tLoadUser)
    } catch (err) {
      console.error("Login: не удалось загрузить пользователя (проверьте DATABASE_URL):", err)
      return NextResponse.json(
        { success: false, error: "Ошибка сервера. Проверьте подключение к базе данных." },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Неверный логин или пароль" },
        { status: 401 }
      )
    }

    const tPassword = performance.now()
    let isValidPassword = false

    if (user.password.startsWith("$2")) {
      isValidPassword = await bcrypt.compare(password, user.password)
    } else {
      isValidPassword = user.password === password
    }
    debugLog("password check (bcrypt/plain)", tPassword)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Неверный логин или пароль" },
        { status: 401 }
      )
    }

    const tSession = performance.now()
    const sessionValue = buildSessionCookieValue({
      id: user.id,
      username: user.username,
      role: user.role as "admin" | "artist",
    })

    const response = NextResponse.json({
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
      },
    })

    response.cookies.set("rossel_session", sessionValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    debugLog("session build", tSession)
    debugLog("TOTAL login request", debugStart)
    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка сервера" },
      { status: 500 }
    )
  }
}
