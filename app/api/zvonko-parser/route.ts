import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { addActivity, findArtistByName, addUser, updateRelease, getUserByUsername, assignReleasesToNewArtist } from '@/lib/storage'
import type { Release } from '@/lib/storage'
import { nicknameToUsername } from '@/lib/utils'
import { splitCollaboratingArtistDisplayNames } from '@/lib/split-artist-names'
import { prisma } from '@/lib/prisma'
import { releaseFromPrisma, userFromPrisma } from '@/lib/storage-adapters'
import { revalidateArtistDashboardsForArtistIds } from '@/lib/revalidate-artist-dashboard'
import { requireAdminOrCron } from '@/lib/server-auth'
import { rateLimitParser } from '@/lib/rate-limit'
import { normalizeReleaseDate } from '@/lib/release-date'
import { releaseDateToSortDate } from '@/lib/release-date-sort'

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
async function markModerationDeliveredAfterParse(parsersDir: string): Promise<number> {
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

  const releaseRows = await prisma.release.findMany({ orderBy: { updatedAt: "desc" } })
  const releases = releaseRows.map(releaseFromPrisma)
  const markedReleases: Release[] = []
  for (const release of releases) {
    const s = (release.status || '').trim()
    if (!MODERATION_STATUSES.some(m => m === s)) continue

    const titleKey = normalizeTitle(release.title)
    const upcKey = normalizeUpc(release.upc || '')
    const stillOnModByTitle = titleKey && modOrRejectedTitles.has(titleKey)
    const stillOnModByUpc = upcKey && modOrRejectedUpcs.has(upcKey)
    if (stillOnModByTitle || stillOnModByUpc) continue

      ; (release as any).status = 'Доставлен'
    markedReleases.push(release)
    console.log(`✅ Zvonko: релиз "${release.title}" больше не на модерации и не отклонён → Доставлен`)
  }
  if (markedReleases.length > 0) {
    await Promise.all(
      markedReleases.map((r) =>
        prisma.release.update({
          where: { id: r.id },
          data: { status: "Доставлен" },
        })
      )
    )
    const artistIds = [...new Set(markedReleases.map((r) => r.artistId).filter(Boolean))] as string[]
    const userRows =
      artistIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: artistIds } } }) : []
    const userById = new Map(userRows.map((row) => [row.id, userFromPrisma(row)]))

    for (const release of markedReleases) {
      const artist = release.artistId ? userById.get(release.artistId) : undefined

      await addActivity({
        type: 'release_status_updated',
        userId: release.artistId,
        userRole: 'artist',
        title: 'Статус релиза обновлён',
        description: `Релиз "${release.title}" переведён в «Доставлен»`,
        metadata: { releaseId: release.id, artistId: release.artistId, status: 'Доставлен' }
      })

      // Дубликат для админа
      await addActivity({
        type: 'release_status_updated',
        userId: 'system',
        userRole: 'admin',
        title: 'Статус релиза обновлён',
        description: `Релиз "${release.title}" переведён в «Доставлен» (артист: ${artist?.name || artist?.username || release.artistId})`,
        metadata: { releaseId: release.id, artistId: release.artistId, artistName: artist?.name, status: 'Доставлен' }
      })
    }

    const dashboardIds: string[] = []
    for (const r of markedReleases) {
      if (r.artistId) dashboardIds.push(r.artistId)
      for (const fid of r.featuredArtistIds || []) dashboardIds.push(fid)
    }
    await revalidateArtistDashboardsForArtistIds(dashboardIds)
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

export async function GET(request: NextRequest) {
  const denied = await requireAdminOrCron(request)
  if (denied) return denied
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

async function syncDbToReleasesJson() {
  try {
    console.log('📥 Экспорт релизов из базы данных в data/releases.json...');
    const dbReleases = await prisma.release.findMany({ orderBy: { createdAt: 'desc' } });
    const baseReleases = dbReleases.map(releaseFromPrisma);
    
    // Подгружаем имена артистов
    const artistIds = [...new Set(baseReleases.map((r) => r.artistId).filter(Boolean))] as string[];
    const users = artistIds.length > 0 
      ? await prisma.user.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, name: true, username: true }
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name || u.username]));
    
    const mappedReleases = baseReleases.map((r: any) => ({
      ...r,
      artistName: r.artistName || (r.artistId ? nameById.get(r.artistId) ?? "" : "")
    }));
    
    const releasesFile = path.join(process.cwd(), 'data', 'releases.json');
    fs.writeFileSync(releasesFile, JSON.stringify(mappedReleases, null, 2), 'utf-8');
    console.log(`✅ Успешно экспортировано ${mappedReleases.length} релизов в releases.json`);
  } catch (error) {
    console.error('❌ Ошибка экспорта из БД в releases.json:', error);
  }
}

async function syncReleasesJsonToDb() {
  try {
    const releasesFile = path.join(process.cwd(), 'data', 'releases.json');
    if (!fs.existsSync(releasesFile)) {
      console.warn('⚠️ Файл data/releases.json не найден для импорта в БД');
      return;
    }
    
    console.log('📤 Импорт релизов из data/releases.json в базу данных...');
    const fileContent = fs.readFileSync(releasesFile, 'utf-8');
    if (!fileContent.trim()) {
      console.warn('⚠️ Файл data/releases.json пуст');
      return;
    }
    
    const jsonReleases = JSON.parse(fileContent);
    console.log(`   Найдено релизов в файле: ${jsonReleases.length}`);
    
    let upsertedCount = 0;
    
    for (const r of jsonReleases) {
      const { 
        id, title, artistId, releaseDate, type, coverUrl, tracks, createdAt, updatedAt, upc, status, 
        featuredArtistIds, featuredArtistNames, koalaId, bandlinkUrl, ...extra 
      } = r;
      
      const tracksArray = Array.isArray(tracks) ? tracks : [];
      
      // Находим существующий релиз в БД для слияния данных
      const existing = await prisma.release.findUnique({
        where: { id },
        select: { koalaId: true, bandlinkUrl: true, tracks: true, releaseDate: true }
      });
      
      let finalKoalaId = koalaId || null;
      let finalBandlinkUrl = bandlinkUrl || null;
      let finalTracks = tracksArray;
      let finalReleaseDate = releaseDate || '';
      
      if (existing) {
        finalKoalaId = existing.koalaId || koalaId || null;
        finalBandlinkUrl = existing.bandlinkUrl || bandlinkUrl || null;
        
        if (existing.releaseDate && !finalReleaseDate) {
          finalReleaseDate = existing.releaseDate;
        }
        
        const dbTracks = Array.isArray(existing.tracks) ? (existing.tracks as any[]) : [];
        if (dbTracks.length > 0) {
          const dbIsrcCount = dbTracks.filter(t => t.isrc && !t.isrc.startsWith('QZZ')).length;
          const jsonIsrcCount = tracksArray.filter(t => t.isrc && !t.isrc.startsWith('QZZ')).length;
          
          if (dbTracks.length > tracksArray.length || dbIsrcCount > jsonIsrcCount) {
            finalTracks = dbTracks;
          } else {
            finalTracks = tracksArray.map((jt, idx) => {
              const dt = dbTracks[idx];
              if (dt && dt.isrc && !dt.isrc.startsWith('QZZ') && (!jt.isrc || jt.isrc.startsWith('QZZ'))) {
                return { ...jt, isrc: dt.isrc };
              }
              return jt;
            });
          }
        }
      }
      
      // A1: нормализация даты — общим хелпером, а не своей копией логики
      finalReleaseDate = normalizeReleaseDate(finalReleaseDate);
      // A3: этот upsert идёт мимо releaseToPrismaCreate и раньше НЕ заполнял
      // releaseDateSort — такие релизы получали null и при сортировке desc
      // (NULLS FIRST) всплывали наверх списка.
      const finalReleaseDateSort = releaseDateToSortDate(finalReleaseDate);

      await prisma.release.upsert({
        where: { id },
        update: {
          title,
          artistId: artistId || null,
          releaseDate: finalReleaseDate,
          releaseDateSort: finalReleaseDateSort,
          type: type || (finalTracks.length > 1 ? 'album' : 'single'),
          coverUrl: coverUrl || null,
          upc: upc || null,
          status: status || null,
          koalaId: finalKoalaId,
          bandlinkUrl: finalBandlinkUrl,
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
          tracks: finalTracks as any,
          featuredArtistIds: featuredArtistIds || [],
          featuredArtistNames: featuredArtistNames || [],
          metadata: Object.keys(extra).length > 0 ? extra : null,
        },
        create: {
          id,
          title,
          artistId: artistId || null,
          releaseDate: finalReleaseDate,
          releaseDateSort: finalReleaseDateSort,
          type: type || (finalTracks.length > 1 ? 'album' : 'single'),
          coverUrl: coverUrl || null,
          upc: upc || null,
          status: status || null,
          koalaId: finalKoalaId,
          bandlinkUrl: finalBandlinkUrl,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
          tracks: finalTracks as any,
          featuredArtistIds: featuredArtistIds || [],
          featuredArtistNames: featuredArtistNames || [],
          metadata: Object.keys(extra).length > 0 ? extra : null,
        }
      });
      upsertedCount++;
    }
    console.log(`✅ Успешно синхронизировано ${upsertedCount} релизов с базой данных Prisma`);
  } catch (error) {
    console.error('❌ Ошибка импорта из releases.json в БД:', error);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminOrCron(request)
  if (denied) return denied
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const rl = rateLimitParser(ip)
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: 'Слишком много запросов' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
    )
  }
  console.log('🚀 Запуск Zvonko Parser...')

  try {
    const body = await request.json()
    const { action = 'parse', pagesToParse = 1 } = body

    // Синхронизируем БД с releases.json перед запуском парсера
    await syncDbToReleasesJson()

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
              console.warn('⚠️ JSON_OUTPUT не найден в stdout и файл результатов отсутствует')
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
                  resolve(code ?? 1)
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
                          resolve(code ?? 1)
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
              const markedDelivered = await markModerationDeliveredAfterParse(parsersDir)
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

        // Автоматически создаём артистов для релизов без artistId (после всех скриптов)
        if (isSuccess && (action === 'parse' || action === 'add')) {
          try {
            console.log('🔍 Проверяем релизы без привязанного артиста...')
            const allReleaseRows = await prisma.release.findMany({ orderBy: { updatedAt: "desc" } })
            const allReleases = allReleaseRows.map(releaseFromPrisma)
            const releasesWithoutArtist = allReleases.filter(r =>
              !r.artistId && (r as any).artistName && (r as any).artistName.trim().length > 0
            )

            if (releasesWithoutArtist.length > 0) {
              console.log(`➕ Найдено ${releasesWithoutArtist.length} релизов без привязанного артиста`)

              const createdArtists = new Map<string, string>() // artistName -> artistId

              for (const release of releasesWithoutArtist) {
                const fullArtistField = ((release as any).artistName || "").trim()
                const nameParts = splitCollaboratingArtistDisplayNames(fullArtistField)
                if (nameParts.length === 0) continue

                const resolvedIds: string[] = []
                for (const artistName of nameParts) {
                  let artistId = createdArtists.get(artistName)

                  if (!artistId) {
                    const existingArtist = await findArtistByName(artistName)

                    if (existingArtist) {
                      artistId = existingArtist.id
                      createdArtists.set(artistName, artistId)
                    } else {
                      const baseLogin = nicknameToUsername(artistName)
                      let username = baseLogin
                      if (await getUserByUsername(username)) {
                        username = baseLogin + "_" + Date.now().toString(36)
                      }
                      console.log(`  ➕ Создаём артиста: ${artistName} (логин: ${username})`)
                      const newArtist = await addUser({
                        username,
                        name: artistName,
                        email: "",
                        role: "artist",
                        password: Math.random().toString(36).slice(-12),
                        verified: false,
                      })
                      artistId = newArtist.id
                      createdArtists.set(artistName, artistId)

                      await addActivity({
                        type: "artist_auto_created" as any,
                        userId: "system",
                        userRole: "admin",
                        title: "Артист создан автоматически",
                        description: `Профиль артиста "${artistName}" создан парсером Zvonko`,
                        metadata: { artistId, source: "zvonko" },
                      })

                      try {
                        const assignedCount = await assignReleasesToNewArtist(
                          artistId,
                          artistName,
                          username
                        )
                        if (assignedCount > 0) {
                          console.log(
                            `  ✅ Привязано ${assignedCount} релиз(ов) к артисту ${artistName}`
                          )
                        }
                      } catch (error) {
                        console.error(
                          `  ⚠️ Ошибка привязки релизов к артисту ${artistName}:`,
                          error
                        )
                      }
                    }
                  }

                  resolvedIds.push(artistId)
                }

                const primaryId = resolvedIds[0]
                const featuredArtistIds =
                  resolvedIds.length > 1 ? resolvedIds.slice(1) : undefined
                if (primaryId) {
                  await updateRelease(release.id, {
                    artistId: primaryId,
                    ...(featuredArtistIds?.length
                      ? { featuredArtistIds }
                      : {}),
                  })
                }
              }

              console.log(`✅ Создано ${createdArtists.size} новых артистов, обновлено ${releasesWithoutArtist.length} релизов`)
            }
          } catch (error) {
            console.error('Ошибка автосоздания артистов:', error)
            // Не останавливаем весь процесс из-за этой ошибки
          }
        }

        // Если парсинг прошел успешно, синхронизируем новые/измененные релизы из JSON обратно в БД
        if (isSuccess) {
          await syncReleasesJsonToDb()
        }

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
