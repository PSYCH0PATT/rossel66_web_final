'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Play, Users, Calendar, ExternalLink, Image, RefreshCw, Save, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Artist {
  id: string;
  name: string;
  username: string;
  releasesCount?: number;
  releases?: Array<{
    title: string;
    releaseDate: string;
  }>;
}

interface ParseResult {
  artist_name?: string;
  artist_url?: string;
  playlist_name: string;
  playlist_url: string;
  playlist_cover_url?: string;
  playlist_artist?: string;
  track_names?: string;
  platform?: string;
  likes_count?: string;
  parsed_at: string;
}

export default function ParsersPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [recentArtists, setRecentArtists] = useState<Artist[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [isLoadingRecentArtists, setIsLoadingRecentArtists] = useState(false);
  const [isParsingVK, setIsParsingVK] = useState(false);
  const [isParsingBandlink, setIsParsingBandlink] = useState(false);
  const [vkResults, setVkResults] = useState<ParseResult[]>([]);
  const [bandlinkResults, setBandlinkResults] = useState<ParseResult[]>([]);
  const [parsingOutput, setParsingOutput] = useState<string>('');
  const [parsingHistory, setParsingHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [bandlinkCookies, setBandlinkCookies] = useState<string>('');
  const [vkCookies, setVkCookies] = useState<string>('');
  const [bandlinkCookiesLastUpdated, setBandlinkCookiesLastUpdated] = useState<string | null>(null);
  const [vkCookiesLastUpdated, setVkCookiesLastUpdated] = useState<string | null>(null);
  const [isSavingBandlinkCookies, setIsSavingBandlinkCookies] = useState(false);
  const [isSavingVkCookies, setIsSavingVkCookies] = useState(false);
  
  useEffect(() => {
    loadArtists();
    loadRecentArtists();
    loadParsingResults();
    loadParsingHistory();
    loadCookies();
  }, []);

  const loadArtists = async () => {
    setIsLoadingArtists(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (data.success) {
        const artistUsers = data.users.filter((user: any) => user.role === 'artist');
        setArtists(artistUsers);
      }
    } catch (error) {
      console.error('Ошибка загрузки артистов:', error);
    } finally {
      setIsLoadingArtists(false);
    }
  };

  const loadRecentArtists = async () => {
    setIsLoadingRecentArtists(true);
    try {
      const response = await fetch('/api/parsers/recent-artists');
      const data = await response.json();
      if (data.success) {
        setRecentArtists(data.artists);
      }
    } catch (error) {
      console.error('Ошибка загрузки недавних артистов:', error);
    } finally {
      setIsLoadingRecentArtists(false);
    }
  };

  const loadParsingResults = async () => {
    try {
      const [vkResponse, bandlinkResponse] = await Promise.all([
        fetch('/api/parsers/vk'),
        fetch('/api/parsers/bandlink')
      ]);
      
      const vkData = await vkResponse.json();
      const bandlinkData = await bandlinkResponse.json();
      
      if (vkData.success) {
        setVkResults(vkData.results || []);
      }
      
      if (bandlinkData.success) {
        setBandlinkResults(bandlinkData.results || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки результатов парсинга:', error);
    }
  };

  const clearResults = async () => {
    if (confirm('Очистить все результаты парсинга из базы данных?')) {
      try {
        const response = await fetch('/api/parsers/clear', {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
          setVkResults([]);
          setBandlinkResults([]);
          setParsingOutput(prev => prev + '\n✅ Все результаты парсинга очищены\n');
        } else {
          alert('Ошибка очистки: ' + data.error);
        }
      } catch (error) {
        console.error('Ошибка очистки результатов:', error);
        alert('Ошибка очистки результатов');
      }
    }
  };

  const handleArtistSelect = (artistId: string, checked: boolean) => {
    if (checked) {
      setSelectedArtists(prev => [...prev, artistId]);
    } else {
      setSelectedArtists(prev => prev.filter(id => id !== artistId));
    }
  };

  const selectAllRecentArtists = () => {
    const recentArtistUsernames = recentArtists.map(artist => artist.username);
    setSelectedArtists(recentArtistUsernames);
  };

  const clearSelection = () => {
    setSelectedArtists([]);
  };

  const runVKParser = async () => {
    if (selectedArtists.length === 0) {
      alert('Выберите артистов для парсинга');
      return;
    }

    setIsParsingVK(true);
    setParsingOutput('Запуск VK парсера...\n');
    
    setParsingOutput(prev => prev + `🔑 Используем 2captcha для автоматического решения VK капчи (настроено на сервере)\n`);

    try {
      // Для VK используем username/id как есть
      const response = await fetch('/api/parsers/vk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artists: selectedArtists
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setParsingOutput(prev => prev + '\n✅ VK парсинг завершен успешно!\n');
        setParsingOutput(prev => prev + data.output + '\n');
        setVkResults(data.results || []);
        loadParsingHistory(); // Обновляем историю
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка VK парсинга: ' + data.error + '\n');
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n');
        }
        loadParsingHistory(); // Обновляем историю даже при ошибке
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n');
      loadParsingHistory();
    } finally {
      setIsParsingVK(false);
    }
  };

  const runBandlinkParser = async () => {
    if (selectedArtists.length === 0) {
      alert('Выберите артистов для парсинга');
      return;
    }

    setIsParsingBandlink(true);
    setParsingOutput('Запуск Bandlink парсера...\n');

    try {
      // Для Bandlink нужны реальные имена артистов, а не username
      const artistNames = selectedArtists.map(artistId => {
        // Ищем в недавних артистах
        const recentArtist = recentArtists.find(a => a.username === artistId);
        if (recentArtist) return recentArtist.name;
        
        // Ищем в общем списке артистов
        const artist = artists.find(a => (a.username || a.name.toLowerCase()) === artistId);
        if (artist) return artist.name;
        
        // Если не найден, возвращаем как есть
        return artistId;
      });

      setParsingOutput(prev => prev + `🔑 Используем 2captcha для автоматического решения Yandex SmartCaptcha\n`);
      setParsingOutput(prev => prev + `🔑 API ключ настроен на сервере\n`);

      const requestBody = {
        artists: artistNames
      };
      
      console.log('📤 Отправляем запрос с телом:', requestBody);
      setParsingOutput(prev => prev + `📤 Отправляем запрос: artists=${artistNames.join(', ')}\n`);

      const response = await fetch('/api/parsers/bandlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        setParsingOutput(prev => prev + '\n✅ Bandlink парсинг завершен успешно!\n');
        setParsingOutput(prev => prev + data.output + '\n');
        setBandlinkResults(data.results || []);
        loadParsingHistory(); // Обновляем историю
      } else {
        setParsingOutput(prev => prev + '\n❌ Ошибка Bandlink парсинга: ' + data.error + '\n');
        if (data.stderr) {
          setParsingOutput(prev => prev + 'Stderr: ' + data.stderr + '\n');
        }
        loadParsingHistory(); // Обновляем историю даже при ошибке
      }
    } catch (error) {
      setParsingOutput(prev => prev + '\n❌ Ошибка запроса: ' + error + '\n');
      loadParsingHistory();
    } finally {
      setIsParsingBandlink(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadParsingHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/parsers/history?type=all&limit=20');
      const data = await response.json();
      if (data.success) {
        setParsingHistory(data.history || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки истории парсинга:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadCookies = async () => {
    try {
      const [bandlinkResponse, vkResponse] = await Promise.all([
        fetch('/api/bandlink/cookies'),
        fetch('/api/vk/cookies')
      ]);
      
      const bandlinkData = await bandlinkResponse.json();
      const vkData = await vkResponse.json();
      
      if (bandlinkData.success && bandlinkData.lastUpdated) {
        setBandlinkCookiesLastUpdated(bandlinkData.lastUpdated);
      }
      
      if (vkData.success && vkData.lastUpdated) {
        setVkCookiesLastUpdated(vkData.lastUpdated);
      }
    } catch (error) {
      console.error('Ошибка загрузки информации о cookies:', error);
    }
  };

  const saveBandlinkCookies = async () => {
    if (!bandlinkCookies.trim()) {
      alert('Введите cookies для Bandlink');
      return;
    }

    setIsSavingBandlinkCookies(true);
    try {
      const response = await fetch('/api/bandlink/cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cookieString: bandlinkCookies
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setBandlinkCookies('');
        setBandlinkCookiesLastUpdated(new Date().toISOString());
        alert(`✅ Cookies Bandlink успешно обновлены (${data.count} шт.)`);
        loadCookies();
      } else {
        alert('❌ Ошибка: ' + data.error);
      }
    } catch (error) {
      console.error('Ошибка сохранения Bandlink cookies:', error);
      alert('❌ Ошибка сохранения cookies');
    } finally {
      setIsSavingBandlinkCookies(false);
    }
  };

  const saveVkCookies = async () => {
    if (!vkCookies.trim()) {
      alert('Введите cookies для VK');
      return;
    }

    setIsSavingVkCookies(true);
    try {
      const response = await fetch('/api/vk/cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cookieString: vkCookies
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setVkCookies('');
        setVkCookiesLastUpdated(new Date().toISOString());
        alert(`✅ Cookies VK успешно обновлены (${data.count} шт.)`);
        loadCookies();
      } else {
        alert('❌ Ошибка: ' + data.error);
      }
    } catch (error) {
      console.error('Ошибка сохранения VK cookies:', error);
      alert('❌ Ошибка сохранения cookies');
    } finally {
      setIsSavingVkCookies(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Парсеры плейлистов</h1>
          <p className="text-muted-foreground">
            Парсинг плейлистов из VK и поиск через Bandlink в МТС Музыке и Яндекс Музыке
          </p>
        </div>
      </div>

      <Tabs defaultValue="control" className="space-y-6">
        <TabsList>
          <TabsTrigger value="control">Управление</TabsTrigger>
          <TabsTrigger value="history">
            История парсинга {parsingHistory.length > 0 && `(${parsingHistory.length})`}
          </TabsTrigger>
          <TabsTrigger value="cookies">Cookies</TabsTrigger>
          <TabsTrigger value="vk-results">
            Результаты VK {vkResults.length > 0 && `(${vkResults.length})`}
          </TabsTrigger>
          <TabsTrigger value="bandlink-results">
            Результаты Bandlink {bandlinkResults.length > 0 && `(${bandlinkResults.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Недавние артисты */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Артисты с релизами за 2 недели
                </CardTitle>
                <CardDescription>
                  Артисты, выпустившие релизы за последние 14 дней
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRecentArtists ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllRecentArtists}
                        disabled={recentArtists.length === 0}
                      >
                        Выбрать всех ({recentArtists.length})
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearSelection}
                        disabled={selectedArtists.length === 0}
                      >
                        Очистить выбор
                      </Button>
                    </div>
                    
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {recentArtists.map((artist) => (
                          <div key={artist.id} className="flex items-center space-x-2 p-2 rounded border">
                            <Checkbox
                              id={`recent-${artist.id}`}
                              checked={selectedArtists.includes(artist.username)}
                              onCheckedChange={(checked) => 
                                handleArtistSelect(artist.username, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <label 
                                htmlFor={`recent-${artist.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {artist.name}
                              </label>
                              <div className="text-xs text-muted-foreground">
                                {artist.releasesCount} релиз(ов)
                              </div>
                            </div>
                            <Badge variant="secondary">
                              {artist.releasesCount}
                            </Badge>
                          </div>
                        ))}
                        {recentArtists.length === 0 && (
                          <p className="text-center text-muted-foreground py-4">
                            Нет артистов с релизами за последние 2 недели
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Все артисты */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Все артисты
                </CardTitle>
                <CardDescription>
                  Выберите конкретных артистов для парсинга
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingArtists ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {artists.map((artist) => (
                        <div key={artist.id} className="flex items-center space-x-2 p-2 rounded border">
                          <Checkbox
                            id={`artist-${artist.id}`}
                            checked={selectedArtists.includes(artist.username || artist.name.toLowerCase())}
                            onCheckedChange={(checked) => 
                              handleArtistSelect(artist.username || artist.name.toLowerCase(), checked as boolean)
                            }
                          />
                          <label 
                            htmlFor={`artist-${artist.id}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {artist.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Управление парсингом */}
          <Card>
            <CardHeader>
              <CardTitle>Запуск парсеров</CardTitle>
              <CardDescription>
                Выбрано артистов: {selectedArtists.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Информация о 2captcha API ключе */}
              <div className="space-y-2">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">🔑</span>
                    <span className="text-sm font-medium text-green-800">
                      2captcha API ключ настроен на сервере
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1">
                    API ключ от 2captcha.com настроен в переменных окружения сервера для автоматического решения Yandex SmartCaptcha (Bandlink) и VK капчи.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={runVKParser}
                  disabled={isParsingVK || selectedArtists.length === 0}
                  className="flex items-center gap-2"
                >
                  {isParsingVK ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Парсить VK
                </Button>
                
                <Button 
                  onClick={runBandlinkParser}
                  disabled={isParsingBandlink || selectedArtists.length === 0}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  {isParsingBandlink ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Парсить Bandlink
                </Button>

                <Button 
                  onClick={clearResults}
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                >
                  Очистить результаты
                </Button>
              </div>

              {parsingOutput && (
                <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
                  <pre>{parsingOutput}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    История парсинга
                  </CardTitle>
                  <CardDescription>
                    История всех запусков парсеров с результатами и ошибками
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadParsingHistory}
                  disabled={isLoadingHistory}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {parsingHistory.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={item.parser_type === 'bandlink' ? 'default' : 'secondary'}>
                                {item.parser_type === 'bandlink' ? 'Bandlink' : 'VK'}
                              </Badge>
                              {item.status === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : item.status === 'failed' ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              )}
                              <span className="text-sm font-medium">
                                {item.status === 'completed' ? 'Успешно' : item.status === 'failed' ? 'Ошибка' : 'Выполняется'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Артисты:</strong> {item.artists}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Найдено плейлистов:</span>
                                <span className="ml-2 font-medium">{item.playlists_found || 0}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Добавлено:</span>
                                <span className="ml-2 font-medium text-green-600">{item.playlists_added || 0}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {formatDateTime(item.started_at)}
                            </p>
                            {item.errors && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                                <div className="flex items-center gap-2 mb-1">
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                  <span className="text-sm font-medium text-red-800">Ошибки:</span>
                                </div>
                                <pre className="text-xs text-red-700 whitespace-pre-wrap">{item.errors}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {parsingHistory.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        История парсинга пуста
                      </p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cookies" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bandlink Cookies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Cookies Bandlink
                </CardTitle>
                <CardDescription>
                  Вставьте cookies для Bandlink в формате строки (каждая строка: name=value)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Вставьте cookies для Bandlink...&#10;_yascZbPBpGejBI8wyUctjcuMZQX8ThOZfHYB5DN8GWR3zkzmGIuIN9V4/Lu9t62ssa13vA==&#10;_ym_d1768914125&#10;..."
                  value={bandlinkCookies}
                  onChange={(e) => setBandlinkCookies(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button
                  onClick={saveBandlinkCookies}
                  disabled={isSavingBandlinkCookies || !bandlinkCookies.trim()}
                  className="w-full"
                >
                  {isSavingBandlinkCookies ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Обновить Cookies
                </Button>
                {bandlinkCookiesLastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Последнее обновление: {formatDateTime(bandlinkCookiesLastUpdated)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* VK Cookies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Cookies VK
                </CardTitle>
                <CardDescription>
                  Вставьте cookies для VK в формате строки (каждая строка: name=value)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Вставьте cookies для VK...&#10;adblock1&#10;domain_sidw3y9a5vc6Kz6rEXNpmFZX%3A1768866028820&#10;httokenjzx5WH7NpAcA8fnDeklUB6xDpwlgX4bAGyi5jYNGT3JsF-q-K7ACAWN3IXZXjmJgIBzPumtgTSgGud6x72Oy5EhMpk9kajtz_W3WaSDbQwXUjzV9HLoIEj5KZG8v5hbFK1k&#10;..."
                  value={vkCookies}
                  onChange={(e) => setVkCookies(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button
                  onClick={saveVkCookies}
                  disabled={isSavingVkCookies || !vkCookies.trim()}
                  className="w-full"
                >
                  {isSavingVkCookies ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Обновить Cookies
                </Button>
                {vkCookiesLastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Последнее обновление: {formatDateTime(vkCookiesLastUpdated)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vk-results">
          <Card>
            <CardHeader>
              <CardTitle>Результаты парсинга VK</CardTitle>
              <CardDescription>
                Найденные плейлисты из ВКонтакте
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {vkResults.map((result, index) => (
                    <div key={index} className="border rounded p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{result.playlist_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Артист: {result.artist_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Парсинг: {formatDate(result.parsed_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {result.playlist_cover_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={result.playlist_cover_url} target="_blank" rel="noopener noreferrer">
                                <Image className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <a href={result.playlist_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {vkResults.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Результаты парсинга VK отсутствуют
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bandlink-results">
          <Card>
            <CardHeader>
              <CardTitle>Результаты парсинга Bandlink</CardTitle>
              <CardDescription>
                Найденные плейлисты из МТС Музыки и Яндекс Музыки
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {bandlinkResults.map((result, index) => (
                    <div key={index} className="border rounded p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{result.playlist_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Артист: {result.artist_name}
                          </p>
                          {result.playlist_artist && (
                            <p className="text-sm text-muted-foreground">
                              Исполнитель плейлиста: {result.playlist_artist}
                            </p>
                          )}
                          {result.track_names && (
                            <p className="text-sm text-muted-foreground">
                              Треки: {result.track_names}
                            </p>
                          )}
                          <div className="flex gap-2">
                            {result.platform && (
                              <Badge variant="secondary">{result.platform}</Badge>
                            )}
                            {result.likes_count && (
                              <Badge variant="outline">{result.likes_count} лайков</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Парсинг: {formatDate(result.parsed_at)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {result.playlist_cover_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={result.playlist_cover_url} target="_blank" rel="noopener noreferrer">
                                <Image className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                          {result.playlist_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={result.playlist_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {bandlinkResults.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Результаты парсинга Bandlink отсутствуют
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
