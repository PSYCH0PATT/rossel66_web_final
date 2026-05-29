import * as XLSX from 'xlsx'
import { findArtistByName, assignReportsToArtist } from './storage'
import { prisma } from './prisma'

// Интерфейс для данных артиста
interface ArtistData {
  [artistName: string]: {
    fullName: string
    shortName: string
    contractNumber: string
    percentage: string
  }
}

// Интерфейс для долей роялти
interface RoyaltyShares {
  [trackCode: string]: {
    [artistName: string]: number
  }
}

// Интерфейс для данных трека
interface TrackData {
  code: string
  performer: string
  name: string
  album: string
  plays: number
  amount: number
  share: number
}

// Интерфейс для данных артиста с треками
interface ArtistTracks {
  [artistName: string]: {
    [trackKey: string]: TrackData
  }
}

// Транслитерация для имен файлов
function transliterate(text: string): string {
  const rus = "а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я  . , / \\ [ ] { } ( )".split(" ");
  const eng = "a b v g d e yo zh z i y k l m n o p r s t u f h ts ch sh shch _ y _ e yu ya _ _ _ _ _ _ _ _ _ _".split(" ");
  
  let res = text.toLowerCase();
  for (let i = 0; i < rus.length; i++) {
    res = res.split(rus[i]).join(eng[i]);
  }
  return res.replace(/\s+/g, '_').replace(/[^a-z0-9_\.-]/g, '');
}

// Функция для генерации Excel файла в памяти
export function generateReportWorkbook(
  artistName: string,
  tracks: { [trackKey: string]: TrackData }
): Buffer {
  const workbook = XLSX.utils.book_new()
  const worksheetData: (string | number)[][] = [
    ['Код', 'Исполнитель', 'Наименование', 'Альбом', 'Количество', 'Сумма, руб.', 'Доля, %']
  ]
  
  let totalPlays = 0
  let totalAmount = 0
  
  for (const track of Object.values(tracks)) {
    worksheetData.push([
      track.code,
      track.performer,
      track.name,
      track.album,
      track.plays,
      track.amount,
      track.share
    ])
    totalPlays += track.plays
    totalAmount += track.amount
  }
  
  worksheetData.push(['Итого', '', '', '', totalPlays, totalAmount, ''])
  
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  XLSX.utils.book_append_sheet(workbook, worksheet, artistName)
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

// Функция для извлечения артистов из строки исполнителя
function extractArtistsFromTrack(artistStr: string, artistsData: ArtistData): string[] {
  if (!artistStr) return []
  
  const foundArtists: string[] = []
  for (const artistName of Object.keys(artistsData)) {
    if (new RegExp(artistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(artistStr)) {
      foundArtists.push(artistName)
    }
  }
  return foundArtists
}

// Функция для расчета доли артиста
function calculateArtistShare(
  trackCode: string,
  artist: string,
  allArtistsInTrack: string[],
  artistsData: ArtistData,
  royaltyShares: RoyaltyShares
): number {
  if (allArtistsInTrack.length === 1) {
    return 1.0
  }

  if (trackCode in royaltyShares) {
    const trackShares = royaltyShares[trackCode]
    if (artist in trackShares) {
      return trackShares[artist]
    }
  }

  if (allArtistsInTrack.every(a => a in artistsData)) {
    return 1.0 / allArtistsInTrack.length
  }

  const ourArtistsCount = allArtistsInTrack.filter(a => a in artistsData).length
  if (ourArtistsCount > 0) {
    return 1.0 / ourArtistsCount
  }

  return 0.0
}

// Функция для загрузки данных артистов
async function getArtistsData(): Promise<ArtistData> {
  const users = await prisma.user.findMany({
    where: { role: 'artist' },
    select: { id: true, name: true },
  })
  const artistsData: ArtistData = {}

  for (const user of users) {
    artistsData[user.name] = {
      fullName: user.name,
      shortName: user.name,
      contractNumber: `ДОГ-${user.id}`,
      percentage: '100%',
    }
  }

  return artistsData
}

// Функция для загрузки долей роялти
function getRoyaltyShares(): RoyaltyShares {
  return {}
}

// Основная функция обработки файла отчета
export async function processReportFile(
  file: File,
  quarter: string,
  year: number,
  columnMapping: Record<string, string>
): Promise<{
  success: boolean
  message: string
  processedArtists: number
  reports: any[]
}> {
  try {
    console.log(`Обрабатываем файл: ${file.name}`)
    console.log(`Маппинг столбцов: ${JSON.stringify(columnMapping)}`)
    console.log(`Выбранный квартал: ${quarter}`)

    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    
    console.log("Файл загружен, первые строки:", jsonData.slice(0, 3))

    const artistsData = await getArtistsData()
    const royaltyShares = getRoyaltyShares()
    
    const artistsTracks: ArtistTracks = {}
    
    for (const row of jsonData) {
      const rowObj = row as Record<string, any>
      
      const trackCode = rowObj['Код'] || ''
      const artistStr = String(rowObj['Исполнитель'] || '')
      const trackName = rowObj['Наименование'] || ''
      const albumName = rowObj['Альбом'] || ''
      const plays = Number(rowObj['Количество'] || 0)
      const amount = Number(rowObj['Сумма, руб.'] || 0)
      
      if (!artistStr || artistStr.trim() === '') continue
      
      const artistName = artistStr.trim()
      
      const isRegistered = artistName in artistsData
      const share = isRegistered ? calculateArtistShare(trackCode, artistName, [artistName], artistsData, royaltyShares) : 1.0
      const amountShare = amount * share
      
      const trackKey = `${trackCode}|${artistStr}|${trackName}|${albumName}`
      
      if (!artistsTracks[artistName]) {
        artistsTracks[artistName] = {}
      }
      
      if (!artistsTracks[artistName][trackKey]) {
        artistsTracks[artistName][trackKey] = {
          code: trackCode,
          performer: artistStr,
          name: trackName,
          album: albumName,
          plays: 0,
          amount: 0,
          share: share * 100,
        }
      }
      
      artistsTracks[artistName][trackKey].plays += plays
      artistsTracks[artistName][trackKey].amount += amountShare
    }
    
    const reports: any[] = []
    const processedArtists = Object.keys(artistsTracks).length
    
    console.log(`Найдено артистов в файле: ${processedArtists}`)
    console.log(`Список артистов:`, Object.keys(artistsTracks))
    
    for (const [artistName, tracks] of Object.entries(artistsTracks)) {
      const artist = await findArtistByName(artistName)
      const isRegistered = !!artist
      
      console.log(`Обрабатываем артиста: ${artistName}, зарегистрирован: ${isRegistered}`)
      
      let totalPlays = 0
      let totalAmount = 0
      
      for (const track of Object.values(tracks)) {
        totalPlays += track.plays
        totalAmount += track.amount
      }
      
      const fileBuffer = generateReportWorkbook(artistName, tracks)
      const fileName = `${artistName}_${quarter}_${year}.xlsx`
      const cleanFileName = transliterate(fileName)
      const filePath = `${quarter}/${cleanFileName}`
      
      reports.push({
        id: `report_${Date.now()}_${Math.random()}`,
        artistId: artist?.id ?? null,
        artistName,
        quarter,
        year,
        fileName,
        filePath,
        uploadedAt: new Date().toISOString(),
        processed: true,
        uploadDate: new Date().toISOString(),
        status: 'processed',
        totalPlays,
        totalAmount,
        isRegistered,
        fileBuffer,
      })
    }
    
    console.log(`Всего обработано артистов: ${processedArtists}`)
    
    return {
      success: true,
      message: "Отчеты успешно сгенерированы",
      processedArtists,
      reports,
    }
  } catch (error) {
    console.error("Ошибка при обработке файла:", error)
    throw new Error(`Ошибка при обработке файла: ${error}`)
  }
}

// Функция для автоматического назначения отчетов при создании кабинета артиста
export async function assignReportsToNewArtist(artistId: string, artistName: string): Promise<void> {
  await assignReportsToArtist(artistId, artistName)
}

