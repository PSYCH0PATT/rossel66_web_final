import { NextResponse } from 'next/server';
import { loadReleases, loadUsers } from '@/lib/storage';

export async function GET() {
  try {
    const releases = loadReleases();
    const users = loadUsers();
    
    // Получаем дату 2 недели назад
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Фильтруем релизы за последние 2 недели
    const recentReleases = releases.filter(release => {
      const releaseDate = new Date(release.releaseDate);
      return releaseDate >= twoWeeksAgo;
    });
    
    // Получаем уникальных артистов из недавних релизов
    const artistIds = [...new Set(recentReleases.map(release => release.artistId))];
    
    // Находим информацию об артистах
    const recentArtists = artistIds.map(artistId => {
      // Пробуем разные форматы ID
      let user = users.find(u => u.id === artistId);
      if (!user) {
        user = users.find(u => u.id === artistId.replace('user_', ''));
      }
      if (!user) {
        user = users.find(u => `user_${u.id}` === artistId);
      }
      if (!user) {
        user = users.find(u => u.id.replace('artist', 'user_') === artistId);
      }
      if (!user) {
        user = users.find(u => u.id.replace('user_', 'artist') === artistId);
      }
      
      if (user) {
        // Подсчитываем количество релизов за последние 2 недели
        const artistReleases = recentReleases.filter(r => r.artistId === artistId);
        
        return {
          id: user.id,
          name: user.name,
          username: user.username || user.name.toLowerCase().replace(/\s+/g, ''),
          releasesCount: artistReleases.length,
          releases: artistReleases.map(r => ({
            title: r.title,
            releaseDate: r.releaseDate
          }))
        };
      }
      
      return null;
    }).filter(Boolean);
    
    // Сортируем по количеству релизов (больше релизов = выше приоритет)
    recentArtists.sort((a, b) => b.releasesCount - a.releasesCount);
    
    return NextResponse.json({
      success: true,
      artists: recentArtists,
      totalArtists: recentArtists.length,
      totalReleases: recentReleases.length,
      dateRange: {
        from: twoWeeksAgo.toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения недавних артистов:', error);
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения недавних артистов'
    }, { status: 500 });
  }
}


