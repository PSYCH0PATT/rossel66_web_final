import { NextRequest, NextResponse } from "next/server"
import { loadReports, saveReports, loadUsers } from "@/lib/storage"
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const artistName = formData.get('artistName') as string
    const quarter = formData.get('quarter') as string
    const year = formData.get('year') as string
    const totalAmount = formData.get('totalAmount') as string
    const totalPlays = formData.get('totalPlays') as string

    if (!file || !artistName || !quarter || !year) {
      return NextResponse.json({
        success: false,
        message: "Отсутствуют обязательные поля"
      }, { status: 400 })
    }

    // Читаем Excel файл
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log('Данные из Excel файла:', data.slice(0, 3)) // Первые 3 строки для отладки

    // Пытаемся автоматически извлечь данные из файла
    let calculatedAmount = 0
    let calculatedPlays = 0

    if (data.length > 0) {
      // Ищем столбцы с суммами и прослушиваниями
      const firstRow = data[0] as any
      const keys = Object.keys(firstRow)
      
      // Пытаемся найти столбцы с числовыми данными
      for (const row of data) {
        for (const key of keys) {
          const value = (row as any)[key]
          if (typeof value === 'number') {
            // Если значение больше 1000, вероятно это прослушивания
            if (value > 1000) {
              calculatedPlays += value
            } else if (value > 0) {
              // Иначе это может быть сумма
              calculatedAmount += value
            }
          }
        }
      }
    }

    // Используем переданные значения или рассчитанные
    const finalAmount = totalAmount ? parseFloat(totalAmount) : calculatedAmount
    const finalPlays = totalPlays ? parseInt(totalPlays) : calculatedPlays

    // Проверяем, зарегистрирован ли артист
    const users = loadUsers()
    const registeredArtist = users.find(user => 
      user.role === 'artist' && 
      (user.name.toLowerCase() === artistName.toLowerCase() || 
       user.username.toLowerCase() === artistName.toLowerCase())
    )

    // Создаем отчет
    const reports = loadReports()
    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const newReport = {
      id: reportId,
      artistId: registeredArtist?.id || `unregistered_${Date.now()}`,
      artistName: artistName,
      quarter: quarter,
      year: parseInt(year),
      fileName: file.name,
      filePath: `uploads/${reportId}_${file.name}`, // Путь к файлу
      uploadDate: new Date().toISOString(),
      status: 'processed' as const, // Статус обработки
      totalPlays: finalPlays,
      totalAmount: finalAmount,
      isRegistered: !!registeredArtist,
      isSigned: false,
      isPaid: false,
    }

    reports.push(newReport)
    saveReports(reports)

    console.log('Создан новый отчет:', newReport)

    return NextResponse.json({
      success: true,
      message: `Отчет успешно загружен! ${registeredArtist ? 'Артист найден в системе.' : 'Артист не зарегистрирован.'} Обработано ${data.length} треков.`,
      report: {
        id: reportId,
        artistName: artistName,
        isRegistered: !!registeredArtist,
        totalAmount: finalAmount,
        totalPlays: finalPlays,
        tracksCount: data.length
      }
    })

  } catch (error) {
    console.error('Ошибка при загрузке отчета:', error)
    return NextResponse.json({
      success: false,
      message: "Ошибка при обработке файла"
    }, { status: 500 })
  }
}
