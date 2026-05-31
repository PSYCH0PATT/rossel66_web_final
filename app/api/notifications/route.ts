import { NextRequest, NextResponse } from "next/server"
import { getParserRunStatus } from "@/lib/parser-status"
import { requireAdmin } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request)
  if (denied) return denied

  try {
    const status = await getParserRunStatus("bandlink")
    const needsNewCookies = status.needsNewCookies

    let message: string | null = null
    if (needsNewCookies) {
      message = `⚠️ Требуются новые cookies! Парсинг не работает после ${status.failedAttempts} неудачных попыток.`
    }

    return NextResponse.json({
      success: true,
      hasNotification: needsNewCookies,
      message,
      status: {
        status: status.status,
        lastRun: status.lastRun,
        needsNewCookies,
        failedAttempts: status.failedAttempts,
      },
    })
  } catch (error) {
    console.error("Ошибка проверки уведомлений:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка проверки уведомлений" },
      { status: 500 }
    )
  }
}
