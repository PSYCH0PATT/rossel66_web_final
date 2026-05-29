import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/server-auth'
import { supabase, ensureBucketExists } from '@/lib/supabase'
import { exportPrismaDataForPython, cleanupExportedData } from '@/lib/export-data-for-python'

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

function findTemplatePath(): string {
  const baseDir = process.cwd()
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
  return path.join(baseDir, 'Отчёт MENDXZA.xlsx')
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

  const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const tempFilePath = `/tmp/temp_upload_${requestId}.xlsx`
  const reportsOutDir = `/tmp/reports_out_${requestId}`
  const metadataJsonPath = `/tmp/metadata_${requestId}.json`
  let exportedPaths: { usersPath: string, releasesPath: string } | null = null

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const quarter = formData.get('quarter') as string
    const year = parseInt(formData.get('year') as string)

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    // 1. Export users/releases from Prisma for Python
    exportedPaths = await exportPrismaDataForPython(requestId)

    // 2. Save uploaded file to /tmp
    const ab = await file.arrayBuffer()
    fs.writeFileSync(tempFilePath, new Uint8Array(ab))
    console.log(`Файл сохранен во временный путь: ${tempFilePath}`)

    // 3. Call Python script
    const pythonScript = path.join(process.cwd(), 'lib', 'python-report-processor.py')
    const args = [
      pythonScript, 
      tempFilePath, 
      quarter, 
      year.toString(),
      exportedPaths.usersPath,
      exportedPaths.releasesPath,
      reportsOutDir,
      metadataJsonPath
    ]
    
    // Choose Python from .venv (pandas, openpyxl); otherwise system python3
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python3')
    const pythonCmd =
      process.platform === 'win32'
        ? 'py'
        : (fs.existsSync(venvPython) ? venvPython : 'python3')
        
    const templatePath = findTemplatePath()
    console.log(`Используемый шаблон для отчетов: ${templatePath}`)
    console.log(`Запуск Python: ${pythonCmd} ${args.join(' ')}`)
    const pythonProcess = spawn(pythonCmd, args, {
      env: {
        ...process.env,
        TEMPLATE_PATH: templatePath
      }
    })

    let output = ''
    let errorOutput = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
      console.log(`Python stdout: ${data}`)
    })

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.error(`Python stderr: ${data}`)
    })

    return new Promise<Response>((resolve) => {
      pythonProcess.on('close', async (code) => {
        // Cleanup input temp file immediately
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath)
          }
        } catch (err) {
          console.error('Ошибка при удалении temp_upload:', err)
        }

        if (code === 0) {
          console.log('Python скрипт выполнен успешно')
          let uploadStats = { uploaded: 0, failed: 0, failedNames: [] as string[] };
          
          try {
            // Read generated metadata
            if (fs.existsSync(metadataJsonPath)) {
              const currentReports = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'))
              
              // Ensure bucket exists
              await ensureBucketExists('reports')

              for (const report of currentReports) {
                const localFilePath = report.filePath
                let finalFilePath = report.filePath

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
                      uploadStats.uploaded++
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
                      artistName: report.artistName || report.artistId,
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

          resolve(NextResponse.json({
            success: true,
            message: 'Отчеты успешно созданы',
            output: output,
            quarter,
            year,
            uploadStats
          }))
        } else {
          // Failure branch cleanup
          if (exportedPaths) cleanupExportedData(exportedPaths)
          try {
            if (fs.existsSync(metadataJsonPath)) fs.unlinkSync(metadataJsonPath)
            if (fs.existsSync(reportsOutDir)) {
              fs.rmSync(reportsOutDir, { recursive: true, force: true })
            }
          } catch (err) {}

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
    // Top-level cleanup if exception happened before Spawn/Promise resolve
    if (exportedPaths) cleanupExportedData(exportedPaths)
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath)
      if (fs.existsSync(metadataJsonPath)) fs.unlinkSync(metadataJsonPath)
      if (fs.existsSync(reportsOutDir)) {
        fs.rmSync(reportsOutDir, { recursive: true, force: true })
      }
    } catch (err) {}

    console.error('Ошибка в API:', error)
    return NextResponse.json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    }, { status: 500 })
  }
}
