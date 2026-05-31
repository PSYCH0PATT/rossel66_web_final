import { NextRequest, NextResponse } from "next/server"
import { parseCookiesFromInput } from "@/lib/parse-cookies-input"
import {
  deleteParserCookies,
  listParserCookies,
  replaceParserCookies,
} from "@/lib/parser-cookies"
import { requireAdmin } from "@/lib/server-auth"

export async function GET() {
  try {
    const data = await listParserCookies("vk")
    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Ошибка получения VK cookies:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка получения cookies" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const body = await request.json()
    const { curlCommand, cookieString } = body
    const input = curlCommand || cookieString

    if (!input) {
      return NextResponse.json(
        { success: false, error: "Curl команда или строка с cookies не предоставлена" },
        { status: 400 }
      )
    }

    const cookies = parseCookiesFromInput(input)
    if (cookies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cookies не найдены. Убедитесь, что формат правильный (curl команда или строка с cookies в формате name=value)",
        },
        { status: 400 }
      )
    }

    console.log(`📥 Получено ${cookies.length} VK cookies для обновления (Postgres)`)
    const count = await replaceParserCookies("vk", cookies)

    return NextResponse.json({
      success: true,
      message: `VK cookies успешно обновлены (${count} шт.)`,
      count,
      cookieNames: cookies.map((c) => c.name),
    })
  } catch (error) {
    console.error("Ошибка обновления VK cookies:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка обновления cookies" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    await deleteParserCookies("vk")
    return NextResponse.json({
      success: true,
      message: "Все VK cookies удалены",
    })
  } catch (error) {
    console.error("Ошибка удаления VK cookies:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка удаления cookies" },
      { status: 500 }
    )
  }
}
