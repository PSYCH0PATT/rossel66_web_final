import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import sqlite3 from 'sqlite3'
import { requireAdminOrCron } from '@/lib/server-auth'

export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdminOrCron(request)
    if (denied) return denied

    const { id, type } = await request.json()

    if (!id || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing id or type' },
        { status: 400 }
      )
    }

    // Определяем базу данных и таблицу
    const dbPath = type === 'vk' ? 'artist_playlists.db' : 'bandlink_playlists.db'
    const tableName = type === 'vk' ? 'artist_playlists' : 'bandlink_playlists'

    // Подключаемся к базе данных
    const db = new sqlite3.Database(dbPath)

    await new Promise<void>((resolve, reject) => {
      db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    db.close()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления плейлиста:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

