import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { addReport, ReportData, findArtistByName, assignReportsToArtist } from './storage'
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
  // Если артист только один, он получает 100%
  if (allArtistsInTrack.length === 1) {
    return 1.0
  }

  // Проверяем наличие кода трека в таблице с долями
  if (trackCode in royaltyShares) {
    const trackShares = royaltyShares[trackCode]
    if (artist in trackShares) {
      return trackShares[artist]
    }
  }

  // Если все артисты в треке зарегистрированы, делим поровну
  if (allArtistsInTrack.every(a => a in artistsData)) {
    return 1.0 / allArtistsInTrack.length
  }

  // Считаем количество зарегистрированных артистов в треке
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

// Функция для загрузки долей роялти (пока используем заглушку)
function getRoyaltyShares(): RoyaltyShares {
  // В реальном приложении здесь будет загрузка из файла или базы данных
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
  reports: ReportData[]
}> {
  try {
    console.log(`Обрабатываем файл: ${file.name}`)
    console.log(`Маппинг столбцов: ${JSON.stringify(columnMapping)}`)
    console.log(`Выбранный квартал: ${quarter}`)

    // Читаем файл Excel
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    
    // Предполагаем, что первый лист содержит данные
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    
    console.log("Файл загружен, первые строки:", jsonData.slice(0, 3))

    // Получаем данные артистов и доли роялти
    const artistsData = await getArtistsData()
    const royaltyShares = getRoyaltyShares()
    
    // Создаем структуру для хранения данных по артистам и трекам
    const artistsTracks: ArtistTracks = {}
    
    // Обрабатываем каждую строку данных (как в оригинальном Python коде)
    for (const row of jsonData) {
      const rowObj = row as Record<string, any>
      
      // Используем русские названия столбцов напрямую (как в оригинале)
      const trackCode = rowObj['Код'] || ''
      const artistStr = String(rowObj['Исполнитель'] || '')
      const trackName = rowObj['Наименование'] || ''
      const albumName = rowObj['Альбом'] || ''
      const plays = Number(rowObj['Количество'] || 0)
      const amount = Number(rowObj['Сумма, руб.'] || 0)
      
      // Если нет данных об артисте, пропускаем
      if (!artistStr || artistStr.trim() === '') continue
      
      // Создаем отчет для артиста (независимо от того, есть ли он в базе)
      const artistName = artistStr.trim()
      
      // Если артист не найден в базе, все равно создаем для него отчет
      const isRegistered = artistName in artistsData
      const share = isRegistered ? calculateArtistShare(trackCode, artistName, [artistName], artistsData, royaltyShares) : 1.0
      const amountShare = amount * share
      
      const trackKey = `${trackCode}|${artistStr}|${trackName}|${albumName}`
      
      // Инициализируем данные для артиста, если их еще нет
      if (!artistsTracks[artistName]) {
        artistsTracks[artistName] = {}
      }
      
      // Инициализируем данные для трека, если их еще нет
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
      
      // Обновляем данные для трека
      artistsTracks[artistName][trackKey].plays += plays
      artistsTracks[artistName][trackKey].amount += amountShare
    }
    
    // Создаем отчеты для каждого артиста (как в оригинальном Python коде)
    const reports: ReportData[] = []
    const processedArtists = Object.keys(artistsTracks).length
    
    console.log(`Найдено артистов в файле: ${processedArtists}`)
    console.log(`Список артистов:`, Object.keys(artistsTracks))
    
    for (const [artistName, tracks] of Object.entries(artistsTracks)) {
      // Ищем артиста в системе
      const artist = await findArtistByName(artistName)
      const isRegistered = !!artist
      
      console.log(`Обрабатываем артиста: ${artistName}, зарегистрирован: ${isRegistered}`)
      
      // Рассчитываем итоговые значения
      let totalPlays = 0
      let totalAmount = 0
      
      for (const track of Object.values(tracks)) {
        totalPlays += track.plays
        totalAmount += track.amount
      }
      
      // Создаем Excel файл для артиста (как в оригинальном коде)
      if (isRegistered) {
        console.log(`Создаем файл для зарегистрированного артиста: ${artistName}`)
        await createArtistReportFile(artist!.id, artistName, tracks, quarter, year, '')
      } else {
        // Если артист не зарегистрирован, сохраняем в папку незарегистрированных
        console.log(`Создаем файл для незарегистрированного артиста: ${artistName}`)
        await createUnregisteredReportFile(artistName, tracks, quarter, year, '')
      }
      
      // Добавляем информацию о созданном файле
      reports.push({
        id: `report_${Date.now()}_${Math.random()}`,
        artistId: artist?.id ?? '',
        artistName,
        quarter,
        year,
        fileName: `${artistName}_${quarter}_${year}.xlsx`,
        filePath: isRegistered 
          ? `data/artists/${artist!.id}/reports/${quarter}/${artistName}_${quarter}_${year}.xlsx`
          : `data/unregistered-reports/${quarter}/${artistName}_${quarter}_${year}.xlsx`,
        uploadedAt: new Date().toISOString(),
        processed: true,
        uploadDate: new Date().toISOString(),
        status: 'processed',
        totalPlays,
        totalAmount,
        isRegistered,
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

// Функция для создания файла отчета для зарегистрированного артиста
async function createArtistReportFile(
  artistId: string,
  artistName: string,
  tracks: { [trackKey: string]: TrackData },
  quarter: string,
  year: number,
  reportId: string
): Promise<void> {
  const artistDir = path.join(process.cwd(), 'data', 'artists', artistId, 'reports', quarter)
  if (!fs.existsSync(artistDir)) {
    fs.mkdirSync(artistDir, { recursive: true })
  }
  
  const fileName = `${artistName}_${quarter}_${year}.xlsx`
  const filePath = path.join(artistDir, fileName)
  
  // Создаем Excel файл
  const workbook = XLSX.utils.book_new()
  
  // Создаем лист с данными артиста
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
  
  // Добавляем итоговую строку
  worksheetData.push(['Итого', '', '', '', totalPlays, totalAmount, ''])
  
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  XLSX.utils.book_append_sheet(workbook, worksheet, artistName)
  
  // Сохраняем файл
  try {
    XLSX.writeFile(workbook, filePath)
    console.log(`Создан файл отчета: ${filePath}`)
  } catch (error) {
    console.error(`Ошибка при сохранении файла ${filePath}:`, error)
    throw error
  }
}

// Функция для создания файла отчета для незарегистрированного артиста
async function createUnregisteredReportFile(
  artistName: string,
  tracks: { [trackKey: string]: TrackData },
  quarter: string,
  year: number,
  reportId: string
): Promise<void> {
  const unregisteredDir = path.join(process.cwd(), 'data', 'unregistered-reports', quarter)
  if (!fs.existsSync(unregisteredDir)) {
    fs.mkdirSync(unregisteredDir, { recursive: true })
  }
  
  const fileName = `${artistName}_${quarter}_${year}.xlsx`
  const filePath = path.join(unregisteredDir, fileName)
  
  // Создаем Excel файл
  const workbook = XLSX.utils.book_new()
  
  // Создаем лист с данными артиста
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
  
  // Добавляем итоговую строку
  worksheetData.push(['Итого', '', '', '', totalPlays, totalAmount, ''])
  
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
  XLSX.utils.book_append_sheet(workbook, worksheet, artistName)
  
  // Сохраняем файл
  try {
    XLSX.writeFile(workbook, filePath)
    console.log(`Создан файл отчета: ${filePath}`)
  } catch (error) {
    console.error(`Ошибка при сохранении файла ${filePath}:`, error)
    throw error
  }
}

// Функция для автоматического назначения отчетов при создании кабинета артиста
export async function assignReportsToNewArtist(artistId: string, artistName: string): Promise<void> {
  await assignReportsToArtist(artistId, artistName)
}
