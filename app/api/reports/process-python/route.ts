import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { processReports } from '@/lib/report-processing'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/server-auth'
import { supabase, ensureBucketExists } from '@/lib/supabase'
import { exportPrismaDataForPython, cleanupExportedData } from '@/lib/export-data-for-python'
import { supersedeLinkedProfileReports } from '@/lib/storage'

function transliterate(text: string): string {
  const ru: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y',
    'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh',
    'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
    'Е': 'E', 'Ё': 'E', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y',
    'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh',
    'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  }
  return text.split('').map(char => ru[char] ?? char).join('')
}

import {
  type ArtistReportRequiredField,
} from '@/lib/artist-report-requirements'

type IncompleteArtistFromPython = {
  name: string
  missingFields: ArtistReportRequiredField[]
}

function incompleteReportMessage(incomplete: IncompleteArtistFromPython[]): string {
  if (incomplete.length === 0) return 'Ошибка при обработке файла'
  return `У ${incomplete.length} артистов не хватает обязательных данных для отчёта (ФИО, договор, процент)`
}

/** Отчёт в ответе API: то, что показывает генератор после прогона. */
type ReportMetadataFromPython = {
  id: string
  artistName: string
  isRegistered: boolean
  totalPlays: number
  totalAmount: number
}

function resolveApprovalDate(raw: FormDataEntryValue | null): string {
  const today = new Date().toISOString().slice(0, 10)
  if (!raw || typeof raw !== 'string') return today
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today
}

function findTemplatePath(): string {
  const baseDir = process.cwd()
  const libTemplate = path.join(baseDir, 'lib', 'templates', 'report-mendxza.xlsx')
  if (fs.existsSync(libTemplate)) {
    return libTemplate
  }
  const possibleNames = [
    'Отчёт MENDXZA.xlsx', // NFD
    'Отчёт MENDXZA.xlsx', // NFC
    'Отчет MENDXZA.xlsx', // е instead of ё
  ]
  for (const name of possibleNames) {
    const fullPath = path.join(baseDir, name)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }
  try {
    const files = fs.readdirSync(baseDir)
    const matched = files.find(f => f.includes('MENDXZA') && f.endsWith('.xlsx'))
    if (matched) {
      return path.join(baseDir, matched)
    }
  } catch (err) {
    console.error('Ошибка при поиске шаблона в директории:', err)
  }
  return path.join(baseDir, 'lib', 'templates', 'report-mendxza.xlsx')
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const tempFilePath = `/tmp/temp_upload_${requestId}.xlsx`
  const reportsOutDir = `/tmp/reports_out_${requestId}`
  const metadataJsonPath = `/tmp/metadata_${requestId}.json`
  const columnMappingPath = `/tmp/column_mapping_${requestId}.json`
  let exportedPaths: { usersPath: string, releasesPath: string } | null = null

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const quarter = formData.get('quarter') as string
    const year = parseInt(formData.get('year') as string)

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    const columnMapping = {
      isrc_column: String(formData.get('isrc_column') ?? ''),
      track_name_column: String(formData.get('track_name_column') ?? ''),
      album_name_column: String(formData.get('album_name_column') ?? ''),
      artist_column: String(formData.get('artist_column') ?? ''),
      plays_column: String(formData.get('plays_column') ?? ''),
      amount_column: String(formData.get('amount_column') ?? ''),
    }
    const hasColumnMapping = Object.values(columnMapping).some(Boolean)
    if (hasColumnMapping) {
      fs.writeFileSync(columnMappingPath, JSON.stringify(columnMapping))
      console.log(`Маппинг столбцов сохранён: ${columnMappingPath}`, columnMapping)
    }

    const approvalDate = resolveApprovalDate(formData.get('approval_date'))

    // 1. Export users/releases from Prisma for Python
    exportedPaths = await exportPrismaDataForPython(requestId)

    // 2. Save uploaded file to /tmp
    const ab = await file.arrayBuffer()
    fs.writeFileSync(tempFilePath, new Uint8Array(ab))
    console.log(`Файл сохранен во временный путь: ${tempFilePath}`)

    // 3. Собираем отчёты. Раньше здесь запускался python-процесс, из-за чего
    // генерация работала только там, где установлен интерпретатор с pandas —
    // на Vercel её не было вовсе. Теперь это тот же TypeScript в обоих контурах.
    const templatePath = findTemplatePath()
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({
        success: false,
        message: `Шаблон отчёта не найден: ${templatePath}. Должен быть lib/templates/report-mendxza.xlsx`,
      }, { status: 500 })
    }

    fs.mkdirSync(reportsOutDir, { recursive: true })
    const users = JSON.parse(fs.readFileSync(exportedPaths.usersPath, 'utf-8'))
    const releases = JSON.parse(fs.readFileSync(exportedPaths.releasesPath, 'utf-8'))

    const processed = await processReports({
      statementPath: tempFilePath,
      quarter,
      year,
      users,
      releases,
      reportsDir: reportsOutDir,
      templatePath,
      columnMapping: hasColumnMapping ? columnMapping : null,
      approvalDate: new Date(`${approvalDate}T00:00:00Z`),
    })
    for (const line of processed.logs) console.log(line)
    const output = processed.logs.join('\n')

        // Cleanup input temp file immediately
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath)
          }
          if (fs.existsSync(columnMappingPath)) {
            fs.unlinkSync(columnMappingPath)
          }
        } catch (err) {
          console.error('Ошибка при удалении temp_upload:', err)
        }

        {
          let uploadStats = {
            uploaded: 0,
            failed: 0,
            failedNames: [] as string[],
            uploadedNames: [] as string[],
          }
          let reportsForResponse: ReportMetadataFromPython[] = []
          
          try {
            {
              const currentReports = processed.metadata
              reportsForResponse = currentReports.map((report: {
                id: string
                artistName: string
                isRegistered?: boolean
                totalPlays?: number
                totalAmount?: number
              }) => ({
                id: report.id,
                artistName: report.artistName,
                isRegistered: report.isRegistered ?? false,
                totalPlays: report.totalPlays ?? 0,
                totalAmount: report.totalAmount ?? 0,
              }))
              
              // Ensure bucket exists
              await ensureBucketExists('reports')

              // Каждый отчёт в собственном try: раньше один try накрывал весь цикл,
              // и падение на одной строке (например P2002) обрывало запись всех
              // оставшихся отчётов прогона.
              const supersedeTargets: { artistId: string; quarter: string; year: number | null }[] = []
              for (const report of currentReports) {
                try {
                const localFilePath = report.filePath
                let finalFilePath = report.filePath
                let uploadedToStorage = false

                if (fs.existsSync(localFilePath)) {
                  let uploadSuccess = false
                  let attempts = 0
                  const maxAttempts = 3
                  const fileBuffer = fs.readFileSync(localFilePath)
                  const cleanFileName = transliterate(report.fileName)
                  const supabasePath = `${quarter}/${cleanFileName}`

                  while (attempts < maxAttempts && !uploadSuccess) {
                    attempts++
                    try {
                      console.log(`Загружаем отчет в Supabase Storage: ${supabasePath} (Попытка ${attempts}/${maxAttempts})`)
                      const { error: uploadError } = await supabase.storage
                        .from('reports')
                        .upload(supabasePath, fileBuffer, {
                          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          upsert: true
                        })

                      if (uploadError) throw uploadError
                      
                      console.log(`Успешно загружен в Supabase: ${supabasePath}`)
                      finalFilePath = supabasePath
                      uploadSuccess = true
                      uploadedToStorage = true
                      uploadStats.uploaded++
                      uploadStats.uploadedNames.push(report.artistName || report.fileName)
                    } catch (uploadErr) {
                      console.error(`Ошибка при загрузке ${report.fileName} в Supabase (Попытка ${attempts}/${maxAttempts}):`, uploadErr)
                      if (attempts >= maxAttempts) {
                        uploadStats.failed++
                        uploadStats.failedNames.push(report.artistName || report.fileName)
                      } else {
                        await new Promise(res => setTimeout(res, 2000))
                      }
                    }
                  }
                } else {
                  console.error(`Файл отчета не найден локально для загрузки: ${localFilePath}`)
                  uploadStats.failed++
                  uploadStats.failedNames.push(report.artistName || report.fileName)
                }

                // G5: если файл не загружен в Storage, finalFilePath указывает на /tmp,
                // который удаляется в finally → отчёт будет невозможно скачать.
                // Не создаём/не обновляем строку отчёта в этом случае.
                if (!uploadedToStorage) {
                  console.error(`Пропуск записи отчёта в БД (файл не загружен в Storage): ${report.fileName}`)
                  continue
                }

                // Check for existing report
                const existing = await prisma.report.findFirst({
                  where: {
                    OR: [
                      { artistName: report.artistName, quarter: report.quarter, year: report.year },
                      ...(report.artistId ? [{ artistId: report.artistId, quarter: report.quarter, year: report.year }] : [])
                    ]
                  }
                })

                if (!existing) {
                  await prisma.report.create({
                    data: {
                      id: report.id,
                      artistId: report.artistId || null,
                      artistName: report.artistName || report.artistId || 'Неизвестный артист',
                      quarter: report.quarter,
                      year: report.year,
                      fileName: report.fileName,
                      filePath: finalFilePath,
                      uploadDate: report.uploadDate || new Date().toISOString(),
                      status: report.status || 'processed',
                      totalPlays: report.totalPlays || 0,
                      totalAmount: report.totalAmount || 0,
                      isRegistered: report.isRegistered ?? true,
                      isSigned: false,
                      isPaid: false,
                      isAcknowledged: false,
                      processed: true,
                    }
                  })
                  console.log(`Добавлен новый отчёт в БД: ${report.id}`)
                } else {
                  await prisma.report.update({
                    where: { id: existing.id },
                    data: {
                      artistId: report.artistId || null,
                      filePath: finalFilePath,
                      totalPlays: report.totalPlays || 0,
                      totalAmount: report.totalAmount || 0,
                      isRegistered: report.isRegistered ?? true
                    }
                  })
                  console.log(`Обновлен отчёт в БД: ${existing.id}`)
                }

                if (report.artistId) {
                  supersedeTargets.push({
                    artistId: report.artistId,
                    quarter: report.quarter,
                    year: report.year ?? null,
                  })
                }
                } catch (reportErr) {
                  console.error(`Ошибка сохранения отчёта ${report.fileName}:`, reportErr)
                }
              }

              // Деньги группы связанных профилей теперь лежат в отчёте главного —
              // старые пер-профильные отчёты за этот же квартал гасим, иначе баланс
              // и дашборд посчитают суммы дважды.
              for (const target of supersedeTargets) {
                try {
                  const count = await supersedeLinkedProfileReports(
                    target.artistId,
                    target.quarter,
                    target.year
                  )
                  if (count > 0) {
                    console.log(
                      `Погашено отчётов привязанных профилей за ${target.quarter} ${target.year}: ${count}`
                    )
                  }
                } catch (supersedeErr) {
                  console.error('Ошибка гашения отчётов привязанных профилей:', supersedeErr)
                }
              }
            }
          } catch (dbErr) {
            console.error('Ошибка сохранения отчетов:', dbErr)
          } finally {
            // Final cleanup of temp directories/files
            if (exportedPaths) cleanupExportedData(exportedPaths)
            try {
              if (fs.existsSync(metadataJsonPath)) fs.unlinkSync(metadataJsonPath)
              if (fs.existsSync(reportsOutDir)) {
                fs.rmSync(reportsOutDir, { recursive: true, force: true })
              }
            } catch (cleanupErr) {
              console.error('Ошибка очистки временных файлов/папок:', cleanupErr)
            }
          }

          const incompleteArtists = processed.incompleteArtists
          const { unmatchedArtists, unmatchedTruncated } = processed

          return NextResponse.json({
            success: true,
            message: incompleteArtists.length
              ? `Отчёты созданы. Пропущено артистов без полных данных: ${incompleteArtists.length}`
              : 'Отчеты успешно созданы',
            unmatchedArtists,
            unmatchedTruncated,
            output: output,
            quarter,
            year,
            uploadStats,
            reports: reportsForResponse,
            processedArtists: reportsForResponse.length,
            incompleteArtists,
          })
        }

  } catch (error) {
    // Top-level cleanup if exception happened before Spawn/Promise resolve
    if (exportedPaths) cleanupExportedData(exportedPaths)
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
      if (fs.existsSync(columnMappingPath)) fs.unlinkSync(columnMappingPath)
      if (fs.existsSync(metadataJsonPath)) fs.unlinkSync(metadataJsonPath)
      if (fs.existsSync(reportsOutDir)) {
        fs.rmSync(reportsOutDir, { recursive: true, force: true })
      }
    } catch (err) {}

    console.error('Ошибка в API:', error)
    const isSchemaDrift =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2022'
    return NextResponse.json({
      success: false,
      message: isSchemaDrift
        ? 'Схема базы данных устарела. Выполните pnpm db:migrate на Supabase.'
        : 'Внутренняя ошибка сервера',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}
