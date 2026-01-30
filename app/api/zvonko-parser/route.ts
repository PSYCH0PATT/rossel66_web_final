import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { loadReleases, saveReleases, addActivity } from '@/lib/storage'
import type { Release } from '@/lib/storage'

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

const MODERATION_STATUSES = ['Модерируется', 'Модерация', 'модерируется', 'модерация']
const ZVONKO_MOD_REJECTED = ['Модерация', 'Отклонен', 'модерация', 'отклонен']

function normalizeTitle(title: string): string {
  return (title || '').toLowerCase().trim()
}

function normalizeUpc(upc: string): string {
  return (upc || '').trim().replace(/^0+/, '')
}

/**
 * Релизы, которые были на модерации, но после парсера НЕТ ни во вкладке модерации,
 * ни во вкладке отклонённых — считаем доставленными и помечаем статус «Доставлен».
 */
function markModerationDeliveredAfterParse(parsersDir: string): number {
  const zvonkoFile = path.join(parsersDir, 'zvonko_all_releases_full.json')
  if (!fs.existsSync(zvonkoFile)) return 0

  let zvonkoReleases: any[] = []
  try {
    zvonkoReleases = JSON.parse(fs.readFileSync(zvonkoFile, 'utf-8'))
  } catch {
    return 0
  }

  const modOrRejectedTitles = new Set<string>()
  const modOrRejectedUpcs = new Set<string>()
  for (const r of zvonkoReleases) {
    const status = (r.status || '').trim().toLowerCase()
    if (status === 'модерация' || status === 'отклонен') {
      const t = normalizeTitle(r.title)
      if (t) modOrRejectedTitles.add(t)
      const u = normalizeUpc(r.upc)
      if (u) modOrRejectedUpcs.add(u)
    }
  }

  const releases = loadReleases()
  const markedReleases: Release[] = []
  for (const release of releases) {
    const s = (release.status || '').trim()
    if (!MODERATION_STATUSES.some(m => m === s)) continue

    const titleKey = normalizeTitle(release.title)
    const upcKey = normalizeUpc(release.upc || '')
    const stillOnModByTitle = titleKey && modOrRejectedTitles.has(titleKey)
    const stillOnModByUpc = upcKey && modOrRejectedUpcs.has(upcKey)
    if (stillOnModByTitle || stillOnModByUpc) continue

    ;(release as any).status = 'Доставлен'
    markedReleases.push(release)
    console.log(`✅ Zvonko: релиз "${release.title}" больше не на модерации и не отклонён → Доставлен`)
  }
  if (markedReleases.length > 0) {
    saveReleases(releases)
    for (const release of markedReleases) {
      addActivity({
        type: 'release_status_updated',
        userId: release.artistId,
        userRole: 'artist',
        title: 'Статус релиза обновлён',
        description: `Релиз "${release.title}" переведён в «Доставлен»`,
        metadata: { releaseId: release.id, artistId: release.artistId, status: 'Доставлен' }
      })
    }
  }
  return markedReleases.length
}

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
    const { action = 'parse', pagesToParse = 1 } = body
    
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
              const jsonText = jsonMatch[1].trim()
              if (!jsonText) {
                throw new Error('Empty JSON content between markers')
              }
              const parsedReleases = JSON.parse(jsonText)
              stats.total = parsedReleases.length || 0
              message = `Найдено ${stats.total} релизов`
              
              // Берем последние релизы для отображения
              releases = parsedReleases.slice(-10).reverse()
              
              // Определяем количество обработанных страниц
              if (parsedReleases.length > 0) {
                pagesProcessed = Math.max(...parsedReleases.map((r: any) => r.page || 1))
              }
            } catch (e) {
              console.error('Ошибка парсинга JSON из stdout:', e)
              console.error('JSON текст:', jsonMatch[1].substring(0, 500))
              stats.errors.push(`Ошибка парсинга JSON: ${e instanceof Error ? e.message : String(e)}`)
            }
          } else {
            // Пробуем прочитать из файла
            const resultsFile = path.join(parsersDir, 'zvonko_all_releases_full.json')
            if (fs.existsSync(resultsFile)) {
              try {
                const fileContent = fs.readFileSync(resultsFile, 'utf-8')
                if (!fileContent.trim()) {
                  throw new Error('File is empty')
                }
                const results = JSON.parse(fileContent)
                stats.total = results.length || 0
                message = `Найдено ${stats.total} релизов`
                releases = results.slice(-10).reverse()
                
                if (results.length > 0) {
                  pagesProcessed = Math.max(...results.map((r: any) => r.page || 1))
                }
              } catch (e) {
                console.error('Ошибка чтения файла результатов:', e)
                stats.errors.push(`Ошибка чтения файла результатов: ${e instanceof Error ? e.message : String(e)}`)
              }
            } else {
              // Если JSON не найден ни в stdout, ни в файле
              console.warning('⚠️ JSON_OUTPUT не найден в stdout и файл результатов отсутствует')
              console.log('Вывод парсера (последние 1000 символов):', output.substring(Math.max(0, output.length - 1000)))
              stats.errors.push('JSON_OUTPUT не найден в выводе парсера')
              message = 'Парсинг завершен, но результаты не найдены'
            }
          }
          
          // После успешного парсинга автоматически запускаем сравнение и добавление
          // ВАЖНО: Это должно выполняться ДО отправки ответа, чтобы статистика была актуальной
          if (action === 'parse' && stats.total > 0 && code === 0) {
            console.log('🔄 Автоматически запускаем сравнение релизов...')
            
            try {
              // Запускаем compare
              const compareScript = path.join(parsersDir, 'compare_releases.py')
              const compareProcess = spawn('python3', [compareScript], { cwd: process.cwd() })
              
              let compareOutput = ''
              let compareError = ''
              
              compareProcess.stdout.on('data', (data) => {
                compareOutput += data.toString()
                console.log('Compare:', data.toString())
              })
              
              compareProcess.stderr.on('data', (data) => {
                compareError += data.toString()
                console.error('Compare Error:', data.toString())
              })
              
              // Ждем завершения процесса сравнения
              const compareCode = await new Promise<number>((resolve) => {
                compareProcess.on('close', (code) => {
                  resolve(code)
                })
              })
              
              if (compareCode === 0) {
                console.log('✅ Сравнение завершено')
                
                // Читаем результаты сравнения
                const comparisonFile = path.join(parsersDir, 'comparison_results.json')
                if (fs.existsSync(comparisonFile)) {
                  try {
                    const comparisonResults = JSON.parse(fs.readFileSync(comparisonFile, 'utf-8'))
                    const newReleasesCount = comparisonResults.summary?.new_releases || 0
                    const existingByUpc = comparisonResults.summary?.existing_by_upc || 0
                    const existingByTitle = comparisonResults.summary?.existing_by_title || 0
                    
                    console.log(`📊 Найдено новых релизов: ${newReleasesCount}`)
                    console.log(`📊 Существующих релизов: ${existingByUpc + existingByTitle}`)
                    
                    // Если есть новые релизы или существующие для обновления, запускаем добавление
                    if (newReleasesCount > 0 || existingByUpc > 0 || existingByTitle > 0) {
                      console.log('🔄 Автоматически запускаем добавление/обновление релизов...')
                      
                      const addScript = path.join(parsersDir, 'add_new_releases.py')
                      const addProcess = spawn('python3', [addScript], { cwd: process.cwd() })
                      
                      let addOutput = ''
                      let addError = ''
                      
                      addProcess.stdout.on('data', (data) => {
                        addOutput += data.toString()
                        console.log('Add:', data.toString())
                      })
                      
                      addProcess.stderr.on('data', (data) => {
                        addError += data.toString()
                        console.error('Add Error:', data.toString())
                      })
                      
                      // Ждем завершения процесса добавления
                      const addCode = await new Promise<number>((resolve) => {
                        addProcess.on('close', (code) => {
                          resolve(code)
                        })
                      })
                      
                      if (addCode === 0) {
                        console.log('✅ Добавление завершено')
                        
                        // Читаем отчет о добавлении
                        const reportFile = path.join(parsersDir, 'add_releases_report.json')
                        if (fs.existsSync(reportFile)) {
                          try {
                            const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'))
                            const addedCount = report.summary?.added || 0
                            const updatedCount = report.summary?.updated || 0
                            
                            // ОБНОВЛЯЕМ статистику ПЕРЕД отправкой ответа
                            stats.added = addedCount
                            stats.updated = updatedCount
                            stats.skipped = existingByUpc + existingByTitle
                            
                            if (addedCount > 0 || updatedCount > 0) {
                              message = `Добавлено ${addedCount} новых релизов${updatedCount > 0 ? `, обновлено ${updatedCount} статусов` : ''}`
                            } else {
                              message = `Найдено ${stats.total} релизов, новых для добавления: ${newReleasesCount}`
                            }
                            
                            console.log(`📊 Добавлено: ${addedCount}, Обновлено: ${updatedCount}`)
                          } catch (e) {
                            console.error('Ошибка чтения отчета добавления:', e)
                            stats.errors.push(`Ошибка чтения отчета: ${e instanceof Error ? e.message : String(e)}`)
                          }
                        }
                      } else {
                        console.error(`❌ Ошибка добавления релизов (код: ${addCode})`)
                        stats.errors.push(`Ошибка добавления релизов: ${addError || 'Неизвестная ошибка'}`)
                      }
                    } else {
                      console.log('ℹ️ Новых релизов для добавления нет')
                      stats.skipped = existingByUpc + existingByTitle
                      message = `Найдено ${stats.total} релизов, все уже есть в системе`
                    }
                  } catch (e) {
                    console.error('Ошибка чтения результатов сравнения:', e)
                    stats.errors.push(`Ошибка чтения результатов сравнения: ${e instanceof Error ? e.message : String(e)}`)
                  }
                } else {
                  console.error('❌ Файл результатов сравнения не найден')
                  stats.errors.push('Файл результатов сравнения не найден')
                }
              } else {
                console.error(`❌ Ошибка сравнения релизов (код: ${compareCode})`)
                stats.errors.push(`Ошибка сравнения релизов: ${compareError || 'Неизвестная ошибка'}`)
              }

              // Проверка «модерация/отклонённые → доставлен» выполняется и при ошибке compare (файл Zvonko уже есть)
              const markedDelivered = markModerationDeliveredAfterParse(parsersDir)
              if (markedDelivered > 0) {
                console.log(`✅ Zvonko: помечено как Доставлен (были на модерации): ${markedDelivered}`)
                message = (message ? message + '. ' : '') + `${markedDelivered} релизов переведены в Доставлен`
              }
            } catch (error) {
              console.error('❌ Ошибка при автоматическом запуске compare/add:', error)
              stats.errors.push(`Ошибка автоматического запуска: ${error instanceof Error ? error.message : String(error)}`)
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
        
        // Проверяем, есть ли критические ошибки
        const hasCriticalErrors = stats.errors.length > 0 && stats.total === 0 && action === 'parse'
        const isSuccess = !hasCriticalErrors
        
        // Сохраняем статус
        const status: ParserStatus = {
          lastRun: new Date().toISOString(),
          success: isSuccess,
          stats,
          message: message || (isSuccess ? 'Парсинг завершен' : 'Парсинг завершен с ошибками'),
          pagesProcessed,
          totalPages
        }
        
        saveParserStatus(status)
        
        resolve(NextResponse.json({ 
          success: isSuccess, 
          message: action === 'parse' ? (isSuccess ? 'Парсинг завершен успешно' : 'Парсинг завершен с ошибками') : message,
          stats,
          releases,
          pagesProcessed,
          totalPages,
          output: output.substring(Math.max(0, output.length - 2000)) // Ограничиваем размер вывода
        }, { status: isSuccess ? 200 : 500 }))
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
