import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { deletePlaylistById } from '@/lib/sftp-playlist-storage'
import { requireAdminOrCron } from '@/lib/server-auth'

/**
 * DELETE /api/parsers/delete-playlist
 * Удаляет одну карточку плейлиста по id.
 *
 * F-PARS-2: раньше удаление шло в SQLite (`artist_playlists.db` вообще не существует),
 * а `id` из UI — строковый Postgres id. Роут отвечал success, но карточка
 * возвращалась после перезагрузки. Теперь удаляем из prisma.playlist.
 */
export async function DELETE(request: NextRequest) {
  try {
    const denied = await requireAdminOrCron(request)
    if (denied) return denied

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id' },
        { status: 400 }
      )
    }

    const removed = await deletePlaylistById(String(id))

    if (!removed) {
      return NextResponse.json(
        { success: false, error: 'Плейлист не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления плейлиста:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
