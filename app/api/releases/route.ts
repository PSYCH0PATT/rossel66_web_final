import { NextResponse } from "next/server"
import { loadReleases, addRelease, loadUsers, addActivity, getUserById } from "@/lib/storage"

export async function GET() {
  try {
    const releases = loadReleases()
    
    return NextResponse.json({ success: true, releases })
  } catch (error) {
    console.error('Ошибка при загрузке релизов:', error)
    return NextResponse.json({ success: false, error: 'Failed to load releases' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const releaseData = await request.json()
    
    console.log('Получены данные для создания релиза:', releaseData)
    
    // Валидация обязательных полей
    if (!releaseData.artistId || !releaseData.title || !releaseData.upc) {
      return NextResponse.json(
        { success: false, error: 'artistId, title, and upc are required' },
        { status: 400 }
      )
    }
    
    const newRelease = {
      id: `release_${Date.now()}`,
      artistId: releaseData.artistId,
      title: releaseData.title,
      coverUrl: releaseData.coverUrl || '',
      upc: releaseData.upc,
      releaseDate: releaseData.releaseDate,
      status: releaseData.status || 'moderation',
      tracks: releaseData.tracks || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    console.log('Создаем релиз с данными:', newRelease)
    
    const success = addRelease(newRelease)
    
    if (success) {
      console.log('Релиз успешно сохранен')
      
      // Создаем активность для артиста
      const artist = getUserById(releaseData.artistId)
      if (artist) {
        addActivity({
          type: 'release_added',
          userId: artist.id,
          userRole: 'artist',
          title: 'Добавлен новый релиз',
          description: `Релиз "${newRelease.title}" успешно добавлен`,
          metadata: { releaseId: newRelease.id, releaseTitle: newRelease.title }
        })
      }
      
      return NextResponse.json({ success: true, release: newRelease })
    } else {
      console.log('Ошибка при сохранении релиза')
      return NextResponse.json({ success: false, error: 'Failed to add release' }, { status: 500 })
    }
  } catch (error) {
    console.error('Ошибка при создании релиза:', error)
    return NextResponse.json({ success: false, error: 'Failed to create release' }, { status: 500 })
  }
}