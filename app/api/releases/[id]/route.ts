import { NextResponse } from "next/server"
import { loadReleases, updateRelease, deleteRelease, loadUsers } from "@/lib/storage"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const releases = loadReleases()
    const users = loadUsers()
    
    const release = releases.find(r => r.id === id)
    
    if (!release) {
      return NextResponse.json({ success: false, error: 'Release not found' }, { status: 404 })
    }
    
    // Добавляем информацию об артисте
    const artist = users.find(user => user.id === release.artistId)
    const releaseWithArtist = {
      ...release,
      artistName: artist ? artist.name : 'Неизвестный артист'
    }
    
    return NextResponse.json({ success: true, release: releaseWithArtist })
  } catch (error) {
    console.error('Ошибка при загрузке релиза:', error)
    return NextResponse.json({ success: false, error: 'Failed to load release' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const updates = await request.json()
    
    const success = updateRelease(id, updates)
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Release updated successfully' })
    } else {
      return NextResponse.json({ success: false, error: 'Release not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Ошибка при обновлении релиза:', error)
    return NextResponse.json({ success: false, error: 'Failed to update release' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    
    const success = deleteRelease(id)
    
    if (success) {
      return NextResponse.json({ success: true, message: 'Release deleted successfully' })
    } else {
      return NextResponse.json({ success: false, error: 'Release not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Ошибка при удалении релиза:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete release' }, { status: 500 })
  }
}





