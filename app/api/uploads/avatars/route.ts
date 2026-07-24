import { NextResponse } from "next/server"
import { getSessionUser, requireAuth } from "@/lib/server-auth"
import { supabase, ensureBucketExists } from "@/lib/supabase"
import * as path from "path"

export const runtime = "nodejs"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

/**
 * Загрузка аватара в Supabase Storage (бакет avatars), возвращает короткий
 * public URL. Ранее аватар слался base64 прямо в avatarUrl (max 2000) → всегда
 * падал (F-UI-1). Любой залогиненный пользователь; привязка к профилю — через
 * PUT /api/artists (requireSelfOrAdmin).
 */
export async function POST(request: Request) {
  try {
    const denied = await requireAuth(request)
    if (denied) return denied
    const session = getSessionUser()!

    const formData = await request.formData()
    const file = formData.get("file") as unknown as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: "Файл не передан" }, { status: 400 })
    }

    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { success: false, error: "Файл больше 5 МБ" },
        { status: 400 }
      )
    }

    const rawExt = path.extname((file as any).name || "").toLowerCase()
    const ext = ALLOWED_EXT.includes(rawExt) ? rawExt : ".jpg"
    const filename = `avatar_${session.id}_${Date.now()}${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await ensureBucketExists("avatars", true)

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filename, buffer, {
        contentType: file.type || "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase avatar upload error:", uploadError)
      return NextResponse.json(
        { success: false, error: "Не удалось загрузить: " + uploadError.message },
        { status: 500 }
      )
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(filename)
    return NextResponse.json({ success: true, url: data.publicUrl })
  } catch (error) {
    console.error("Avatar upload error:", error)
    return NextResponse.json({ success: false, error: "Ошибка загрузки" }, { status: 500 })
  }
}
