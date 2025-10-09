import { NextResponse } from 'next/server'
import sqlite3 from 'sqlite3'
import { promisify } from 'util'

export async function DELETE(request: Request) {
  try {
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
    const dbRun = promisify(db.run.bind(db))

    // Удаляем плейлист
    await dbRun(`DELETE FROM ${tableName} WHERE id = ?`, [id])

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

