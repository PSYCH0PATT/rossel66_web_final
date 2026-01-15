import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

interface ParseStats {
  total: number
  added: number
  updated: number
  skipped: number
  errors: string[]
}

interface ParserStatus {
  lastRun: string
  success: boolean
  stats: ParseStats
  message: string
  pagesProcessed?: number
  totalPages?: number
}

// Файл для хранения статуса последнего парсинга
const STATUS_FILE = path.join(process.cwd(), 'data', 'zvonko_parser_status.json')

// Сохранение статуса парсинга
function saveParserStatus(status: ParserStatus) {
  try {
    const dataDir = path.dirname(STATUS_FILE)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2))
  } catch (error) {
    console.error('Ошибка сохранения статуса:', error)
  }
}

// Загрузка статуса парсинга
function loadParserStatus(): ParserStatus | null {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'))
    }
  } catch (error) {
    console.error('Ошибка загрузки статуса:', error)
  }
  return null
}

export async function GET() {
  try {
    const status = loadParserStatus()
    
    if (!status) {
      return NextResponse.json({ 
        success: true, 
        message: 'Парсер еще не запускался',
        status: null
      })
    }
    
    return NextResponse.json({
      success: true,
      status
    })
    
  } catch (error) {
    console.error('Ошибка получения статуса Zvonko парсера:', error)
    return NextResponse.json({
      success: false,
      error: 'Ошибка получения статуса парсера'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 Запуск Zvonko Parser...')
  
  try {
    const body = await request.json()
    const { action = 'parse', pagesToParse = 5 } = body
    
    const parsersDir = path.join(process.cwd(), 'parsers')
    let scriptPath = ''
    let scriptName = ''
    
    switch (action) {
      case 'parse':
        scriptPath = path.join(parsersDir, 'zvonko_linux_parser.py')
        scriptName = 'Zvonko Linux Parser'
        break
      case 'compare':
        scriptPath = path.join(parsersDir, 'compare_releases.py')
        scriptName = 'Compare Releases'
        break
      case 'add':
        scriptPath = path.join(parsersDir, 'add_new_releases.py')
        scriptName = 'Add New Releases'
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Неизвестное действие'
        }, { status: 400 })
    }
    
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({
        success: false,
        error: `Скрипт ${scriptName} не найден`
      }, { status: 404 })
    }
    
    return new Promise<NextResponse>((resolve) => {
      let output = ''
      let errorOutput = ''
      
      // Запускаем Python парсер
      let args = [scriptPath]
      
      if (action === 'parse') {
        args.push(pagesToParse.toString())
      }
      
      const pythonProcess = spawn('python3', args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONPATH: parsersDir
        }
      })
      
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
        console.log('Zvonko Parser:', data.toString())
      })
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error('Zvonko Parser Error:', data.toString())
      })
      
      pythonProcess.on('close', async (code) => {
        console.log(`Python процесс завершился с кодом ${code}`)
        
        if (code !== 0) {
          const errorStatus: ParserStatus = {
            lastRun: new Date().toISOString(),
            success: false,
            stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [errorOutput] },
            message: `Python процесс завершился с кодом ${code}`
          }
          
          saveParserStatus(errorStatus)
          
          resolve(NextResponse.json({ 
            success: false, 
            error: `Python процесс завершился с кодом ${code}`,
            stderr: errorOutput,
            stats: errorStatus.stats
          }, { status: 500 }))
          return
        }
        
        // Парсим результаты в зависимости от действия
        let stats: ParseStats = { total: 0, added: 0, updated: 0, skipped: 0, errors: [] }
        let message = ''
        let releases: any[] = []
        let pagesProcessed = 0
        let totalPages = pagesToParse
        
        if (action === 'parse') {
          // Пробуем извлечь JSON из stdout
          const jsonMatch = output.match(/JSON_OUTPUT_START\n([\s\S]*?)\nJSON_OUTPUT_END/)
          if (jsonMatch) {
            try {
              const parsedReleases = JSON.parse(jsonMatch[1])
              stats.total = parsedReleases.length || 0
              message = `Найдено ${stats.total} релизов`
              
              // Берем последние релизы для отображения
              releases = parsedReleases.slice(-10).reverse()
              
              // Определяем количество обработанных страниц
              if (parsedReleases.length > 0) {
                pagesProcessed = Math.max(...parsedReleases.map((r: any) => r.page || 1))
              }
            } catch (e) {
              console.error('Ошибка парсинга JSON:', e)
              stats.errors.push('Ошибка парсинга JSON')
            }
          } else {
            // Пробуем прочитать из файла
            const resultsFile = path.join(parsersDir, 'zvonko_all_releases_full.json')
            if (fs.existsSync(resultsFile)) {
              try {
                const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'))
                stats.total = results.length || 0
                message = `Найдено ${stats.total} релизов`
                releases = results.slice(-10).reverse()
                
                if (results.length > 0) {
                  pagesProcessed = Math.max(...results.map((r: any) => r.page || 1))
                }
              } catch (e) {
                console.error('Ошибка чтения файла результатов:', e)
                stats.errors.push('Ошибка чтения файла результатов')
              }
            }
          }
        } else if (action === 'compare') {
          // Для сравнения читаем результаты
          const resultsFile = path.join(parsersDir, 'comparison_results.json')
          if (fs.existsSync(resultsFile)) {
            try {
              const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'))
              stats.total = results.summary?.total_zvonko || 0
              stats.added = results.summary?.new_releases || 0
              stats.skipped = results.summary?.existing_by_upc + results.summary?.existing_by_title || 0
              message = `Сравнение завершено. Новых: ${stats.added}, Существующих: ${stats.skipped}`
            } catch (e) {
              console.error('Ошибка чтения результатов сравнения:', e)
              stats.errors.push('Ошибка чтения результатов сравнения')
            }
          }
        } else if (action === 'add') {
          // Для добавления читаем отчет
          const reportFile = path.join(parsersDir, 'add_releases_report.json')
          if (fs.existsSync(reportFile)) {
            try {
              const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'))
              stats.added = report.summary?.added || 0
              stats.total = report.summary?.total_new || 0
              message = `Добавлено ${stats.added} новых релизов`
            } catch (e) {
              console.error('Ошибка чтения отчета добавления:', e)
              stats.errors.push('Ошибка чтения отчета добавления')
            }
          }
        }
        
        // Сохраняем статус
        const successStatus: ParserStatus = {
          lastRun: new Date().toISOString(),
          success: true,
          stats,
          message,
          pagesProcessed,
          totalPages
        }
        
        saveParserStatus(successStatus)
        
        resolve(NextResponse.json({ 
          success: true, 
          message: action === 'parse' ? 'Парсинг завершен успешно' : message,
          stats,
          releases,
          pagesProcessed,
          totalPages,
          output
        }))
      })
    })
    
  } catch (error) {
    console.error('Ошибка Zvonko Parser:', error)
    
    const errorStatus: ParserStatus = {
      lastRun: new Date().toISOString(),
      success: false,
      stats: { total: 0, added: 0, updated: 0, skipped: 0, errors: [String(error)] },
      message: String(error)
    }
    
    saveParserStatus(errorStatus)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера',
      stats: errorStatus.stats
    }, { status: 500 })
  }
}
