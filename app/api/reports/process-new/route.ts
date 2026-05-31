import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"

/** @deprecated Use POST /api/reports/process-python — contract data comes from Supabase only. */
export async function POST(request: Request) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  return NextResponse.json(
    {
      error: "Deprecated",
      message: "Используйте POST /api/reports/process-python. Данные договоров берутся из Supabase (User.fio/contract/percentage).",
    },
    { status: 410 }
  )
}
