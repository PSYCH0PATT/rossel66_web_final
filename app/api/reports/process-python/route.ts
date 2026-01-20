import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
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

    // Вызываем Python скрипт
    // Доли роялти теперь берутся из треков в releases.json (высший приоритет)
    // Файл долей больше не передается - используется только fallback из файла, если он есть в системе
    const pythonScript = path.join(process.cwd(), 'lib', 'python-report-processor.py')
    const args = [pythonScript, tempFilePath, quarter, year.toString()]
    
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

    return new Promise<Response>((resolve) => {
      pythonProcess.on('close', (code) => {
        // Удаляем временные файлы
        try {
          fs.unlinkSync(tempFilePath)
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
