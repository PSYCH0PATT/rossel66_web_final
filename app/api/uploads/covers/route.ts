import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as unknown as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const dir = path.join(process.cwd(), 'public', 'uploads', 'covers')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // Санитизация расширения файла (защита от path traversal)
    const rawExt = path.extname((file as any).name || '')
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const ext = allowedExtensions.includes(rawExt.toLowerCase()) ? rawExt.toLowerCase() : '.jpg'
    const filename = `cover_${Date.now()}${ext}`
    const filepath = path.join(dir, filename)
    fs.writeFileSync(filepath, buffer)

    const url = `/uploads/covers/${filename}`
    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}




