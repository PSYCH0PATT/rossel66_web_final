import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/server-auth'
import { supabase, ensureBucketExists } from '@/lib/supabase'

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

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request)
  if (authError) return authError

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
    const ab = await file.arrayBuffer()
    const tempFilePath = path.join(uploadsDir, 'temp_upload.xlsx')
    fs.writeFileSync(tempFilePath, new Uint8Array(ab))

    console.log(`Файл сохранен: ${tempFilePath}`)

    // Вызываем Python скрипт
    // Доли роялти теперь берутся из треков в releases.json (высший приоритет)
    // Файл долей больше не передается - используется только fallback из файла, если он есть в системе
    const pythonScript = path.join(process.cwd(), 'lib', 'python-report-processor.py')
    const args = [pythonScript, tempFilePath, quarter, year.toString()]
    
    // Предпочитаем Python из .venv (pandas, openpyxl); иначе системный
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python3')
    const pythonCmd =
      process.platform === 'win32'
        ? 'py'
        : (fs.existsSync(venvPython) ? venvPython : 'python3')
    const pythonProcess = spawn(pythonCmd, args)

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
          let uploadStats = { uploaded: 0, failed: 0, failedNames: [] as string[] };
          try {
            const reportsJsonPath = path.join(process.cwd(), 'data', 'reports.json')
            if (fs.existsSync(reportsJsonPath)) {
              const reportsData = JSON.parse(fs.readFileSync(reportsJsonPath, 'utf-8'))
              
              // Фильтруем отчёты по текущему кварталу и году
              const currentReports = reportsData.filter((r: any) => 
                r.quarter === quarter && r.year === year
              )
              
              // Проверяем/создаем бакет
              await ensureBucketExists('reports')

              // Добавляем новые отчёты в БД и загружаем в Supabase
              for (const report of currentReports) {
                const localFilePath = path.join(process.cwd(), report.filePath)
                let finalFilePath = report.filePath

                if (fs.existsSync(localFilePath)) {
                  let uploadSuccess = false;
                  let attempts = 0;
                  const maxAttempts = 3;
                  const fileBuffer = fs.readFileSync(localFilePath);
                  const cleanFileName = transliterate(report.fileName);
                  const supabasePath = `${quarter}/${cleanFileName}`;

                  while (attempts < maxAttempts && !uploadSuccess) {
                    attempts++;
                    try {
                      console.log(`Загружаем отчет в Supabase Storage: ${supabasePath} (Попытка ${attempts}/${maxAttempts})`);
                      const { error: uploadError } = await supabase.storage
                        .from('reports')
                        .upload(supabasePath, fileBuffer, {
                          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                          upsert: true
                        });

                      if (uploadError) throw uploadError;
                      
                      console.log(`Успешно загружен в Supabase: ${supabasePath}`);
                      finalFilePath = supabasePath;
                      uploadSuccess = true;
                      uploadStats.uploaded++;

                      // Удаляем временный локальный файл
                      if (fs.existsSync(localFilePath)) {
                        fs.unlinkSync(localFilePath);
                      }
                    } catch (uploadErr) {
                      console.error(`Ошибка при загрузке ${report.fileName} в Supabase (Попытка ${attempts}/${maxAttempts}):`, uploadErr);
                      if (attempts >= maxAttempts) {
                        console.error(`Не удалось загрузить ${report.fileName} после ${maxAttempts} попыток.`);
                        uploadStats.failed++;
                        uploadStats.failedNames.push(report.artistName || report.fileName);
                      } else {
                        // Ждем 2 секунды перед повторной попыткой
                        await new Promise(resolve => setTimeout(resolve, 2000));
                      }
                    }
                  }
                }

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
                  console.log(`Добавлен отчёт в БД: ${report.id}`)
                } else {
                  // Обновляем путь к файлу в БД
                  await prisma.report.update({
                    where: { id: report.id },
                    data: { filePath: finalFilePath }
                  })
                  console.log(`Обновлен путь отчёта в БД: ${report.id}`)
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
            year,
            uploadStats
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
