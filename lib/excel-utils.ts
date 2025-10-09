import * as XLSX from "xlsx"

// Функция для извлечения артистов из строки исполнителя
export function extractArtistsFromTrack(artistStr: string, registeredArtists: string[]): string[] {
  if (!artistStr) return []

  const foundArtists: string[] = []
  for (const artist of registeredArtists) {
    // Используем регулярное выражение для поиска имени артиста в строке
    const regex = new RegExp(escapeRegExp(artist), "i")
    if (regex.test(artistStr)) {
      foundArtists.push(artist)
    }
  }
  return foundArtists
}

// Вспомогательная функция для экранирования специальных символов в регулярных выражениях
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Функция для расчета доли артиста в треке
export function calculateArtistShare(
  trackCode: string,
  artist: string,
  allArtistsInTrack: string[],
  registeredArtists: string[],
  royaltyShares: Record<string, Record<string, number>>,
): number {
  // Если артист один, он получает 100%
  if (allArtistsInTrack.length === 1) {
    return 1.0
  }

  // Проверяем, есть ли информация о долях для этого трека
  if (royaltyShares[trackCode] && royaltyShares[trackCode][artist]) {
    return royaltyShares[trackCode][artist]
  }

  // Если все артисты в треке зарегистрированы, делим поровну
  if (allArtistsInTrack.every((a) => registeredArtists.includes(a))) {
    return 1.0 / allArtistsInTrack.length
  }

  // Считаем количество зарегистрированных артистов в треке
  const ourArtistsCount = allArtistsInTrack.filter((a) => registeredArtists.includes(a)).length
  if (ourArtistsCount > 0) {
    return 1.0 / ourArtistsCount
  }

  return 0.0
}

// Функция для преобразования буквы столбца Excel в индекс
export function columnLetterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - "A".charCodeAt(0)
}

// Функция для обработки Excel-файла и генерации отчетов
export async function processExcelFile(
  file: File,
  columnMapping: Record<string, string>,
  quarter: string,
  year: number,
  registeredArtists: { id: string; username: string; name: string }[],
): Promise<any[]> {
  // Чтение файла Excel
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data)

  // Предполагаем, что первый лист содержит данные
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)

  // Преобразуем буквы столбцов в индексы
  const columnIndices: Record<string, string> = {}
  for (const [field, letter] of Object.entries(columnMapping)) {
    const index = columnLetterToIndex(letter)
    columnIndices[field] = XLSX.utils.encode_col(index)
  }

  // Создаем структуру для хранения данных по артистам и трекам
  const artistsData: Record<string, Record<string, any>> = {}

  // Получаем список имен зарегистрированных артистов для поиска
  const registeredArtistNames = registeredArtists.map((a) => a.name)
  const registeredArtistUsernames = registeredArtists.map((a) => a.username)

  // Обрабатываем каждую строку данных
  for (const row of jsonData) {
    const rowObj = row as Record<string, any>

    // Получаем данные из соответствующих столбцов
    const isrcCol = columnIndices["isrc_column"]
    const trackNameCol = columnIndices["track_name_column"]
    const albumNameCol = columnIndices["album_name_column"]
    const artistCol = columnIndices["artist_column"]
    const playsCol = columnIndices["plays_column"]
    const amountCol = columnIndices["amount_column"]

    const trackCode = rowObj[isrcCol] || ""
    const trackName = rowObj[trackNameCol] || ""
    const albumName = rowObj[albumNameCol] || ""
    const artistStr = String(rowObj[artistCol] || "")
    const plays = Number(rowObj[playsCol] || 0)
    const amount = Number(rowObj[amountCol] || 0)

    // Находим всех артистов в строке исполнителя
    const trackArtists = extractArtistsFromTrack(artistStr, [...registeredArtistNames, ...registeredArtistUsernames])

    if (trackArtists.length === 0) continue

    // Для каждого найденного артиста создаем запись
    for (const artistName of trackArtists) {
      // Находим артиста в списке зарегистрированных
      const artist = registeredArtists.find(
        (a) =>
          a.name.toLowerCase() === artistName.toLowerCase() || a.username.toLowerCase() === artistName.toLowerCase(),
      )

      // Если артист не найден, пропускаем
      if (!artist) continue

      // Рассчитываем долю артиста в треке
      const share = calculateArtistShare(
        trackCode,
        artistName,
        trackArtists,
        [...registeredArtistNames, ...registeredArtistUsernames],
        {}, // В реальном приложении здесь будут доли артистов
      )

      // Рассчитываем сумму для артиста
      const amountShare = amount * share

      // Создаем ключ для трека
      const trackKey = `${trackCode}|${artistStr}|${trackName}|${albumName}`

      // Инициализируем данные для артиста, если их еще нет
      if (!artistsData[artist.id]) {
        artistsData[artist.id] = {}
      }

      // Инициализируем данные для трека, если их еще нет
      if (!artistsData[artist.id][trackKey]) {
        artistsData[artist.id][trackKey] = {
          code: trackCode,
          performer: artistStr,
          name: trackName,
          album: albumName,
          plays: 0,
          amount: 0,
          share: share * 100,
        }
      }

      // Обновляем данные для трека
      artistsData[artist.id][trackKey].plays += plays
      artistsData[artist.id][trackKey].amount += amountShare
    }
  }

  // Создаем отчеты для каждого артиста
  const reports = []

  for (const [artistId, tracks] of Object.entries(artistsData)) {
    const artist = registeredArtists.find((a) => a.id === artistId)
    if (!artist) continue

    // Создаем отчет для артиста
    const report = {
      id: `r${Date.now()}-${artistId}`,
      artistId,
      quarter,
      year,
      fileUrl: "#", // В реальном приложении здесь будет URL файла
      uploadDate: new Date().toISOString(),
      status: "processed" as const,
      generatedDate: new Date().toISOString(),
      fileName: `${artist.username}_${quarter}_${year}.xlsx`,
      isRegistered: true,
      tracks: Object.values(tracks),
      totalPlays: 0,
      totalAmount: 0,
    }

    // Рассчитываем итоговые значения
    for (const track of Object.values(tracks)) {
      report.totalPlays += track.plays
      report.totalAmount += track.amount
    }

    reports.push(report)
  }

  return reports
}
