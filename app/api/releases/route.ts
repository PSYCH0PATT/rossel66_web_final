import { NextResponse } from "next/server"
import { loadReleases, addRelease, loadUsers, addActivity, getUserById } from "@/lib/storage"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const releases = await loadReleases()
    
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
    
    const createdRelease = await addRelease(newRelease)
    
    console.log('Релиз успешно сохранен')
    
    // Создаем активность для артиста
    const artist = await getUserById(releaseData.artistId)
    if (artist) {
      await addActivity({
        type: 'release_added',
        userId: artist.id,
        userRole: 'artist',
        title: 'Добавлен новый релиз',
        description: `Релиз "${createdRelease.title}" успешно добавлен`,
        metadata: { releaseId: createdRelease.id, releaseTitle: createdRelease.title }
      })
    }
    
    return NextResponse.json({ success: true, release: createdRelease })
  } catch (error) {
    console.error('Ошибка при создании релиза:', error)
    return NextResponse.json({ success: false, error: 'Failed to create release' }, { status: 500 })
  }
}