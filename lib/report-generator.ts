import * as XLSX from "xlsx"

// Функция для извлечения артистов из строки исполнителя
export function extractArtistsFromTrack(artistStr: string, artistsData: Record<string, any[]>): string[] {
  if (!artistStr) return []

  // Преобразуем в строку, если это не строка
  if (typeof artistStr !== "string") {
    artistStr = String(artistStr)
  }

  const foundArtists: string[] = []
  for (const artist of Object.keys(artistsData)) {
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
  artistsData: Record<string, any[]>,
): number {
  // Если артист один, он получает 100%
  if (allArtistsInTrack.length === 1) {
    return 1.0
  }

  // Получаем процент артиста из данных
  const artistPercent = artistsData[artist][3] // Процент находится в 4-м элементе массива (индекс 3)
  if (artistPercent) {
    // Преобразуем процент в число от 0 до 1
    const percentValue = Number.parseInt(artistPercent) / 100
    return percentValue
  }

  // Если все артисты в треке зарегистрированы, делим поровну
  if (allArtistsInTrack.every((a) => a in artistsData)) {
    return 1.0 / allArtistsInTrack.length
  }

  // Считаем количество зарегистрированных артистов в треке
  const ourArtistsCount = allArtistsInTrack.filter((a) => a in artistsData).length
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
  templateFile: File,
  artistsFile: File,
  columnMapping: Record<string, string>,
  quarter: string,
): Promise<any> {
  try {
    console.log(`Обрабатываем файл: ${file.name}`)
    console.log(`Маппинг столбцов: ${JSON.stringify(columnMapping)}`)
    console.log(`Выбранный квартал: ${quarter}`)

    // Чтение файла с данными артистов
    const artistsData = await readArtistsFile(artistsFile)
    console.log("Данные артистов загружены")

    // Чтение файла с отчетом
    const statementData = await file.arrayBuffer()
    const workbook = XLSX.read(statementData)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)
    console.log("Файл отчета загружен, первые строки:", jsonData.slice(0, 3))

    // Чтение шаблона отчета
    const templateData = await templateFile.arrayBuffer()
    const templateWorkbook = XLSX.read(templateData)
    console.log("Шаблон отчета загружен")

    // Преобразуем буквы столбцов в индексы
    const columnIndices: Record<string, number> = {}
    for (const [field, letter] of Object.entries(columnMapping)) {
      columnIndices[field] = columnLetterToIndex(letter)
    }
    console.log("Индексы столбцов:", columnIndices)

    // Создаем структуру для хранения данных по артистам и трекам
    const artistsTracks: Record<string, Record<string, any>> = {}

    // Обрабатываем каждую строку данных
    for (const row of jsonData) {
      const rowObj = row as Record<string, any>
      const columns = Object.keys(rowObj)

      // Проверяем, что в строке достаточно данных
      if (columns.length <= Math.max(...Object.values(columnIndices))) {
        console.warn("Недостаточно столбцов в строке:", rowObj)
        continue
      }

      // Получаем данные из соответствующих столбцов
      const trackCode = rowObj[columns[columnIndices.isrc_column]] || ""
      const trackName = rowObj[columns[columnIndices.track_name_column]] || ""
      const albumName = rowObj[columns[columnIndices.album_name_column]] || ""
      const artistStr = String(rowObj[columns[columnIndices.artist_column]] || "")
      const plays = Number(rowObj[columns[columnIndices.plays_column]] || 0)
      const amount = Number(rowObj[columns[columnIndices.amount_column]] || 0)

      // Находим всех артистов в строке исполнителя
      const trackArtists = extractArtistsFromTrack(artistStr, artistsData)

      if (trackArtists.length === 0) continue

      // Для каждого найденного артиста создаем запись
      for (const artist of trackArtists) {
        // Рассчитываем долю артиста в треке
        const share = calculateArtistShare(trackCode, artist, trackArtists, artistsData)

        // Рассчитываем сумму для артиста
        const amountShare = amount * share

        // Создаем ключ для трека
        const trackKey = `${trackCode}|${artistStr}|${trackName}|${albumName}`

        // Инициализируем данные для артиста, если их еще нет
        if (!artistsTracks[artist]) {
          artistsTracks[artist] = {}
        }

        // Инициализируем данные для трека, если их еще нет
        if (!artistsTracks[artist][trackKey]) {
          artistsTracks[artist][trackKey] = {
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
        artistsTracks[artist][trackKey].plays += plays
        artistsTracks[artist][trackKey].amount += amountShare
      }
    }

    // Генерируем отчеты для каждого артиста
    const reports = []
    const reportFiles = []

    for (const [artist, tracks] of Object.entries(artistsTracks)) {
      // Создаем новую рабочую книгу на основе шаблона
      const artistWorkbook = XLSX.utils.book_new()

      // Копируем листы из шаблона
      for (const sheetName of templateWorkbook.SheetNames) {
        const sheet = templateWorkbook.Sheets[sheetName]
        const newSheet = XLSX.utils.aoa_to_sheet(XLSX.utils.sheet_to_json(sheet, { header: 1 }))
        XLSX.utils.book_append_sheet(artistWorkbook, newSheet, sheetName)
      }

      // Обновляем данные на листе "Итог"
      if (artistWorkbook.Sheets["Итог"]) {
        const ws = artistWorkbook.Sheets["Итог"]

        // Устанавливаем имя артиста (используем краткое имя)
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][1]]], { origin: "B10" })

        // Рассчитываем общую сумму
        const totalAmount = Object.values(tracks).reduce((sum, track) => sum + track.amount, 0)
        XLSX.utils.sheet_add_aoa(ws, [[totalAmount]], { origin: "E14" })

        // Добавляем дополнительные данные артиста
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][0]]], { origin: "B6" }) // ФИО
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][2]]], { origin: "B4" }) // Номер договора
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][3]]], { origin: "D15" }) // Процент
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][0]]], { origin: "D32" }) // ФИО
        XLSX.utils.sheet_add_aoa(ws, [[artistsData[artist][1]]], { origin: "E37" }) // ФИО кратко
      }

      // Создаем новый лист для данных артиста
      const wsData = XLSX.utils.aoa_to_sheet([
        ["Код", "Исполнитель", "Наименование", "Альбом", "Количество", "Сумма, руб.", "Доля, %"],
      ])

      let totalQuantity = 0
      let totalAmount = 0
      let rowIndex = 1

      // Добавляем данные треков
      for (const track of Object.values(tracks)) {
        XLSX.utils.sheet_add_aoa(
          wsData,
          [[track.code, track.performer, track.name, track.album, track.plays, track.amount, track.share]],
          { origin: { r: rowIndex, c: 0 } },
        )
        totalQuantity += track.plays
        totalAmount += track.amount
        rowIndex++
      }

      // Добавляем итоговую строку
      XLSX.utils.sheet_add_aoa(wsData, [["Итого", "", "", "", totalQuantity, totalAmount, ""]], {
        origin: { r: rowIndex, c: 0 },
      })

      // Добавляем лист с данными артиста
      XLSX.utils.book_append_sheet(artistWorkbook, wsData, artist)

      // Генерируем файл
      const excelBuffer = XLSX.write(artistWorkbook, { bookType: "xlsx", type: "array" })
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      // Имя файла
      const fileName = `${artist}_${quarter}_${new Date().getFullYear()}.xlsx`

      // Создаем File объект для сохранения на сервере
      const fileObject = new File([blob], fileName, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      // Добавляем файл в список для сохранения
      reportFiles.push(fileObject)

      // Создаем запись отчета
      reports.push({
        id: `r${Date.now()}-${artist}`,
        artistId: artist,
        quarter,
        year: new Date().getFullYear(),
        fileUrl: URL.createObjectURL(blob),
        uploadDate: new Date().toISOString(),
        status: "processed" as const,
        generatedDate: new Date().toISOString(),
        fileName,
        isRegistered: true,
        totalPlays: totalQuantity,
        totalAmount: totalAmount,
        blob: blob,
      })

      console.log(`Отчет для артиста ${artist} сгенерирован`)
    }

    console.log(`Всего сгенерировано отчетов: ${reports.length}`)

    return {
      success: true,
      message: "Отчеты успешно сгенерированы",
      processedArtists: reports.length,
      quarter,
      reports,
      reportFiles,
    }
  } catch (error) {
    console.error("Ошибка при обработке файлов:", error)
    throw new Error(`Ошибка при обработке файлов: ${error}`)
  }
}

// Функция для чтения файла с данными артистов
async function readArtistsFile(file: File): Promise<Record<string, any[]>> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data)
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(worksheet)

  const artistsData: Record<string, any[]> = {}

  // Пропускаем первую строку (заголовки)
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as Record<string, any>
    const columns = Object.keys(row)

    // Проверяем, что в строке достаточно данных
    if (columns.length >= 5) {
      // Получаем данные из соответствующих столбцов
      // A - Артист, B - ФИО, C - ФИО кратко, D - Номер договора, E - Процент
      const artistCode = row[columns[0]] // Артист (колонка A)
      const fullName = row[columns[1]] // ФИО (колонка B)
      const shortName = row[columns[2]] // ФИО кратко (колонка C)
      const contractNumber = row[columns[3]] // Номер договора (колонка D)
      const percentage = row[columns[4]] // Процент (колонка E)

      if (artistCode) {
        artistsData[artistCode] = [
          fullName || "",
          shortName || "",
          contractNumber || "",
          percentage || "50", // Если процент не указан, используем 50% по умолчанию
        ]
      }
    }
  }

  return artistsData
}
