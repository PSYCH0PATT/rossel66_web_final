"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Banner } from "@/components/ui/banner"
import { FileInput } from "@/components/ui/file-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"
import {
  ARTIST_REPORT_FIELD_LABELS,
  type ArtistReportRequiredField,
} from "@/lib/artist-report-requirements"

interface ColumnMapping {
  isrc_column: string
  track_name_column: string
  album_name_column: string
  artist_column: string
  plays_column: string
  amount_column: string
}

interface ProcessedReport {
  id: string
  artistName: string
  isRegistered: boolean
  totalPlays: number
  totalAmount: number
}

export default function ReportProcessor() {
  const [file, setFile] = useState<File | null>(null)
  const [quarter, setQuarter] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [approvalDate, setApprovalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    isrc_column: "",
    track_name_column: "",
    album_name_column: "",
    artist_column: "",
    plays_column: "",
    amount_column: "",
  })
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    processedArtists: number
    reports: ProcessedReport[]
    output?: string
    error?: string
    uploadStats?: {
      uploaded: number
      failed: number
      failedNames: string[]
      uploadedNames?: string[]
    }
    missingContractArtists?: string[]
    incompleteArtists?: { name: string; missingFields: ArtistReportRequiredField[] }[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleColumnMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      alert("Пожалуйста, выберите файл")
      return
    }

    if (!quarter) {
      alert("Пожалуйста, выберите квартал")
      return
    }

    // Проверяем, что все столбцы выбраны
    const requiredColumns = Object.values(columnMapping)
    if (requiredColumns.some(col => !col)) {
      alert("Пожалуйста, выберите все необходимые столбцы")
      return
    }

    setProcessing(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("quarter", quarter)
      formData.append("year", year.toString())
      formData.append("approval_date", approvalDate)
      
      // Добавляем маппинг столбцов
      Object.entries(columnMapping).forEach(([key, value]) => {
        formData.append(key, value)
      })

      const response = await fetch('/api/reports/process-python', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Ошибка при обработке файла:', error)
      setResult({
        success: false,
        message: "Ошибка при обработке файла",
        processedArtists: 0,
        reports: []
      })
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount)
  }

  const columns = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Обработка отчётов
          </CardTitle>
          <CardDescription>
            Загрузите файл с данными и настройте маппинг столбцов для автоматического распределения отчётов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Загрузка файлов */}
            <div className="space-y-4">
              {/* C-05: светлая info-плашка внутри тёмного кабинета (F-48). */}
              <Banner variant="info" className="rounded-lg p-3 text-sm">
                <strong>ℹ️ Информация:</strong> Данные артистов (ФИО, договор, процент) берутся из профилей артистов в системе.
                Отчёты создаются только для артистов с указанным процентом. Доли роялти берутся из настроек треков в релизах (если указаны).
              </Banner>

              <div className="space-y-2">
                <Label htmlFor="file">Файл с данными (.xlsx)</Label>
                <FileInput
                  id="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  disabled={processing}
                  showFileName={false}
                />
                {file && (
                  <p className="text-sm text-gray-600">
                    Выбран файл: {file.name}
                  </p>
                )}
              </div>
            </div>

            {/* Выбор периода */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quarter">Квартал</Label>
                <Select value={quarter} onValueChange={setQuarter} disabled={processing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите квартал" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">1 квартал (Январь - Март)</SelectItem>
                    <SelectItem value="Q2">2 квартал (Апрель - Июнь)</SelectItem>
                    <SelectItem value="Q3">3 квартал (Июль - Сентябрь)</SelectItem>
                    <SelectItem value="Q4">4 квартал (Октябрь - Декабрь)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Год</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  disabled={processing}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="approval_date">Дата утверждения отчёта</Label>
                <Input
                  id="approval_date"
                  type="date"
                  value={approvalDate}
                  onChange={(e) => setApprovalDate(e.target.value)}
                  disabled={processing}
                />
              </div>
            </div>

            {/* Шаблоны */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Шаблоны маппинга:</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnMapping({
                    isrc_column: "A",
                    track_name_column: "E", 
                    album_name_column: "F",
                    artist_column: "D",
                    plays_column: "G",
                    amount_column: "H"
                  })}
                  disabled={processing}
                >
                  Звонко
                </Button>
              </div>
            </div>

            {/* Маппинг столбцов */}
            <div className="space-y-4">
              <Label>Маппинг столбцов</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="isrc_column">ISRC код</Label>
                  <Select 
                    value={columnMapping.isrc_column} 
                    onValueChange={(value) => handleColumnMappingChange('isrc_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="track_name_column">Название трека</Label>
                  <Select 
                    value={columnMapping.track_name_column} 
                    onValueChange={(value) => handleColumnMappingChange('track_name_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="album_name_column">Название релиза</Label>
                  <Select 
                    value={columnMapping.album_name_column} 
                    onValueChange={(value) => handleColumnMappingChange('album_name_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="artist_column">Исполнитель</Label>
                  <Select 
                    value={columnMapping.artist_column} 
                    onValueChange={(value) => handleColumnMappingChange('artist_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plays_column">Прослушивания</Label>
                  <Select 
                    value={columnMapping.plays_column} 
                    onValueChange={(value) => handleColumnMappingChange('plays_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount_column">Сумма выплат</Label>
                  <Select 
                    value={columnMapping.amount_column} 
                    onValueChange={(value) => handleColumnMappingChange('amount_column', value)}
                    disabled={processing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите столбец" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Кнопка обработки */}
            <Button 
              type="submit" 
              disabled={processing || !file || !quarter}
              className="w-full"
            >
              {processing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Обработка...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Обработать отчёт
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Результат обработки */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Результат обработки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className={`font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.message}
              </p>

              {!result.success && (result.output || result.error) && (
                <Banner variant="danger" icon={null} className="rounded-lg p-4 text-sm">
                  <details>
                    <summary className="cursor-pointer font-medium text-red-200">
                      Подробности ошибки
                    </summary>
                    <ScrollArea className="mt-3" viewportClassName="max-h-48" fadeClassName="from-status-danger/10">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-200/90">
                        {[result.output, result.error].filter(Boolean).join('\n')}
                      </pre>
                    </ScrollArea>
                  </details>
                </Banner>
              )}

              {(result.incompleteArtists?.length ?? result.missingContractArtists?.length ?? 0) > 0 && (
                <Banner variant="warning" icon={null} className="rounded-lg p-4 text-sm">
                  <p className="mb-2 font-medium text-amber-100">
                    Артисты без обязательных данных для отчёта (
                    {result.incompleteArtists?.length ?? result.missingContractArtists?.length}):
                  </p>
                  <p className="mb-2 text-xs text-amber-200/80">
                    Нужны: ФИО, номер договора и процент в Supabase.
                  </p>
                  {result.incompleteArtists && result.incompleteArtists.length > 0 ? (
                    <ScrollArea viewportClassName="max-h-48" fadeClassName="from-status-warning/10">
                      <ul className="space-y-1 font-mono text-xs text-amber-200/90">
                        {result.incompleteArtists.map((artist) => (
                          <li key={artist.name}>
                            {artist.name} — нет:{" "}
                            {artist.missingFields
                              .map((f) => ARTIST_REPORT_FIELD_LABELS[f])
                              .join(", ")}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  ) : (
                    <p className="break-words font-mono text-xs text-amber-200/90">
                      {result.missingContractArtists?.join(", ")}
                    </p>
                  )}
                </Banner>
              )}

              {result.uploadStats && (
                <div className="mt-4 space-y-1 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                  <p className="text-base font-medium text-emerald-400">
                    ✅ Загружено в облако: {result.uploadStats.uploaded}
                  </p>
                  {(result.uploadStats.uploadedNames?.length ?? 0) > 0 && (
                    <ScrollArea className="mt-2" viewportClassName="max-h-48" fadeClassName="from-surface-raised">
                      <ul className="space-y-1 font-mono text-xs text-gray-400">
                        {result.uploadStats.uploadedNames!.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                  {result.uploadStats.failed > 0 && (
                    <div className="mt-2 border-t border-white/10 pt-2">
                      <p className="font-medium text-red-400">
                        ❌ Ошибка загрузки: {result.uploadStats.failed}
                      </p>
                      <p className="mt-1 text-gray-400">
                        {result.uploadStats.failedNames.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {result.success && result.reports && result.reports.length > 0 && (
                <div className="space-y-3">
                  {result.processedArtists && (
                    <p className="text-sm text-gray-400">
                      Обработано артистов: {result.processedArtists}
                    </p>
                  )}

                  <div className="space-y-2">
                    <h4 className="font-medium">Созданные отчёты:</h4>
                    {result.reports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{report.artistName}</span>
                          <Badge variant={report.isRegistered ? "default" : "secondary"}>
                            {report.isRegistered ? "Зарегистрирован" : "Не зарегистрирован"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400">
                          {report.totalPlays.toLocaleString("ru-RU")} прослушиваний • {formatCurrency(report.totalAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
