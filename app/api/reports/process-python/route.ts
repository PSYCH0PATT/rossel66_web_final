import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const artistsFile = formData.get('artistsFile') as File | null
    const royaltyFile = formData.get('royaltyFile') as File | null
    const quarter = formData.get('quarter') as string
    const year = parseInt(formData.get('year') as string)

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    // Создаем папку uploads если не существует
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Сохраняем основной файл
    const buffer = Buffer.from(await file.arrayBuffer())
    const tempFilePath = path.join(uploadsDir, 'temp_upload.xlsx')
    fs.writeFileSync(tempFilePath, buffer)

    console.log(`Файл сохранен: ${tempFilePath}`)

    // Сохраняем файлы артистов и долей если они загружены
    let artistsFilePath = ''
    let royaltyFilePath = ''
    
    if (artistsFile) {
      const artistsBuffer = Buffer.from(await artistsFile.arrayBuffer())
      artistsFilePath = path.join(uploadsDir, 'artists.xlsx')
      fs.writeFileSync(artistsFilePath, artistsBuffer)
      console.log(`Файл артистов сохранен: ${artistsFilePath}`)
    }
    
    if (royaltyFile) {
      const royaltyBuffer = Buffer.from(await royaltyFile.arrayBuffer())
      royaltyFilePath = path.join(uploadsDir, 'royalty_shares.xlsx')
      fs.writeFileSync(royaltyFilePath, royaltyBuffer)
      console.log(`Файл долей сохранен: ${royaltyFilePath}`)
    }

    // Вызываем Python скрипт
    const pythonScript = path.join(process.cwd(), 'lib', 'python-report-processor.py')
    const args = [pythonScript, tempFilePath, quarter, year.toString()]
    if (artistsFilePath) args.push(artistsFilePath)
    if (royaltyFilePath) args.push(royaltyFilePath)
    
    const pythonProcess = spawn('py', args)

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
      console.log(`Python output: ${data}`)
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error(`Python error: ${data}`)
    })

    return new Promise((resolve) => {
      pythonProcess.on('close', (code) => {
        // Удаляем временные файлы
        try {
          fs.unlinkSync(tempFilePath)
          if (artistsFilePath) fs.unlinkSync(artistsFilePath)
          if (royaltyFilePath) fs.unlinkSync(royaltyFilePath)
        } catch (error) {
          console.error('Ошибка при удалении временных файлов:', error)
        }

        if (code === 0) {
          console.log('Python скрипт выполнен успешно')
          resolve(NextResponse.json({
            success: true,
            message: 'Отчеты успешно созданы',
            output: output,
            quarter,
            year
          }))
        } else {
          console.error(`Python скрипт завершился с ошибкой: ${code}`)
          resolve(NextResponse.json({
            success: false,
            message: 'Ошибка при обработке файла',
            error: errorOutput,
            output: output
          }, { status: 500 }))
        }
      })
    })

  } catch (error) {
    console.error('Ошибка в API:', error)
    return NextResponse.json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}
