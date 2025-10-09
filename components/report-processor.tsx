"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react"

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
  const [artistsFile, setArtistsFile] = useState<File | null>(null)
  const [royaltyFile, setRoyaltyFile] = useState<File | null>(null)
  const [quarter, setQuarter] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
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
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleArtistsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setArtistsFile(selectedFile)
    }
  }

  const handleRoyaltyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setRoyaltyFile(selectedFile)
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
      
      // Добавляем файлы артистов и долей (как в оригинальной программе)
      if (artistsFile) {
        formData.append("artistsFile", artistsFile)
      }
      if (royaltyFile) {
        formData.append("royaltyFile", royaltyFile)
      }
      
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
            Обработка отчетов
          </CardTitle>
          <CardDescription>
            Загрузите файл с данными и настройте маппинг столбцов для автоматического распределения отчетов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Загрузка файлов (как в оригинальной программе) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="artistsFile">Список артистов (.xlsx)</Label>
                <Input
                  id="artistsFile"
                  type="file"
                  accept=".xlsx"
                  onChange={handleArtistsFileChange}
                  disabled={processing}
                />
                {artistsFile && (
                  <p className="text-sm text-gray-600">
                    Выбран файл: {artistsFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="royaltyFile">Доли роялти (.xlsx)</Label>
                <Input
                  id="royaltyFile"
                  type="file"
                  accept=".xlsx"
                  onChange={handleRoyaltyFileChange}
                  disabled={processing}
                />
                {royaltyFile && (
                  <p className="text-sm text-gray-600">
                    Выбран файл: {royaltyFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Файл с данными (.xlsx)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  disabled={processing}
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
                    album_name_column: "G",
                    artist_column: "D",
                    plays_column: "H",
                    amount_column: "I"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Обработка...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Обработать отчет
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
              
              {result.success && result.reports && result.reports.length > 0 && (
                <div className="space-y-3">
                  {result.processedArtists && (
                    <p className="text-sm text-gray-600">
                      Обработано артистов: {result.processedArtists}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Созданные отчеты:</h4>
                    {result.reports.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{report.artistName}</span>
                          <Badge variant={report.isRegistered ? "default" : "secondary"}>
                            {report.isRegistered ? "Зарегистрирован" : "Не зарегистрирован"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {report.totalPlays.toLocaleString()} прослушиваний • {formatCurrency(report.totalAmount)}
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
