import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/server-auth"
import { supabase, ensureBucketExists } from "@/lib/supabase"
import * as path from "path"

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request)
    if (denied) return denied

    const formData = await request.formData()
    const file = formData.get('file') as unknown as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Санитизация расширения файла (защита от path traversal)
    const rawExt = path.extname((file as any).name || '')
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const ext = allowedExtensions.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : '.jpg'
    const filename = `cover_${Date.now()}${ext}`

    // Убеждаемся, что бакет существует
    await ensureBucketExists('covers', true)

    // Загружаем в Supabase
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filename, buffer, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ success: false, error: 'Failed to upload to storage: ' + uploadError.message }, { status: 500 })
    }

    const { data } = supabase.storage.from('covers').getPublicUrl(filename)
    const url = data.publicUrl

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
