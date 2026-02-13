import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'

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
      pythonProcess.on('close', async (code) => {
        // Удаляем временные файлы
        try {
          fs.unlinkSync(tempFilePath)
        } catch (error) {
          console.error('Ошибка при удалении временных файлов:', error)
        }

        if (code === 0) {
          console.log('Python скрипт выполнен успешно')
          
          // Читаем метаданные созданных отчётов из reports.json
          try {
            const reportsJsonPath = path.join(process.cwd(), 'data', 'reports.json')
            if (fs.existsSync(reportsJsonPath)) {
              const reportsData = JSON.parse(fs.readFileSync(reportsJsonPath, 'utf-8'))
              
              // Фильтруем отчёты по текущему кварталу и году
              const currentReports = reportsData.filter((r: any) => 
                r.quarter === quarter && r.year === year
              )
              
              // Добавляем новые отчёты в БД
              for (const report of currentReports) {
                // Проверяем, существует ли уже такой отчёт
                const existing = await prisma.report.findUnique({
                  where: { id: report.id }
                })
                
                if (!existing) {
                  await prisma.report.create({
                    data: {
                      id: report.id,
                      artistId: report.artistId || null,
                      artistName: report.artistName || report.artistId,
                      quarter: report.quarter,
                      year: report.year,
                      fileName: report.fileName,
                      filePath: report.filePath,
                      uploadDate: report.uploadDate || new Date().toISOString(),
                      status: report.status || 'processed',
                      totalPlays: report.totalPlays || 0,
                      totalAmount: report.totalAmount || 0,
                      isRegistered: report.isRegistered ?? true,
                      isSigned: false,
                      isPaid: false,
                      processed: true,
                    }
                  })
                  console.log(`Добавлен отчёт в БД: ${report.id}`)
                }
              }
              
              console.log(`Сохранено ${currentReports.length} отчётов в БД`)
            }
          } catch (error) {
            console.error('Ошибка при сохранении отчётов в БД:', error)
          }
          
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
