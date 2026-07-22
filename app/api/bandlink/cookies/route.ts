import { NextRequest, NextResponse } from "next/server"
import { parseCookiesFromInput } from "@/lib/parse-cookies-input"
import {
  deleteParserCookies,
  listParserCookies,
  replaceParserCookies,
} from "@/lib/parser-cookies"
import { resetParserCookieAlert } from "@/lib/parser-status"
import { requireAdmin } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const data = await listParserCookies("bandlink")
    // Never expose cookie values to the client — only names + metadata.
    return NextResponse.json({
      success: true,
      cookies: data.cookies.map((c) => ({ name: c.name, hasValue: Boolean(c.value) })),
      count: data.count,
      lastUpdated: data.lastUpdated,
    })
  } catch (error) {
    console.error("Ошибка получения cookies:", error)
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

    console.log(`📥 Получено ${cookies.length} cookies для обновления (Postgres)`)
    const count = await replaceParserCookies("bandlink", cookies)
    await resetParserCookieAlert("bandlink")

    return NextResponse.json({
      success: true,
      message: `Cookies успешно обновлены (${count} шт.)`,
      count,
      cookieNames: cookies.map((c) => c.name),
    })
  } catch (error) {
    console.error("Ошибка обновления cookies:", error)
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
    await deleteParserCookies("bandlink")
    return NextResponse.json({
      success: true,
      message: "Все cookies удалены",
    })
  } catch (error) {
    console.error("Ошибка удаления cookies:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка удаления cookies" },
      { status: 500 }
    )
  }
}
