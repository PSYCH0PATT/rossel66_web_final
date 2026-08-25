"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Banner } from "@/components/ui/banner"
import { FileInput } from "@/components/ui/file-input"
import { Spinner } from "@/components/ui/spinner"
import { Upload, FileSpreadsheet } from "lucide-react"

export default function SimpleReportUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [artistName, setArtistName] = useState("")
  const [totalAmount, setTotalAmount] = useState("")
  const [totalPlays, setTotalPlays] = useState("")
  const [quarter, setQuarter] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!file) {
      setResult({
        success: false,
        message: "Пожалуйста, выберите файл"
      })
      return
    }

    if (!artistName.trim()) {
      setResult({
        success: false,
        message: "Пожалуйста, укажите имя исполнителя"
      })
      return
    }

    if (!quarter) {
      setResult({
        success: false,
        message: "Пожалуйста, выберите квартал"
      })
      return
    }

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("artistName", artistName.trim())
      formData.append("quarter", quarter)
      formData.append("year", year.toString())
      
      if (totalAmount.trim()) {
        formData.append("totalAmount", totalAmount.trim())
      }
      
      if (totalPlays.trim()) {
        formData.append("totalPlays", totalPlays.trim())
      }

      const response = await fetch('/api/reports/upload-simple', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult(data)
      
      if (data.success) {
        // Очищаем форму при успешной загрузке
        setFile(null)
        setArtistName("")
        setTotalAmount("")
        setTotalPlays("")
        setQuarter("")
        // Сбрасываем input file
        const fileInput = document.getElementById('file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      }
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error)
      setResult({
        success: false,
        message: "Ошибка при загрузке файла"
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    /* C-01/F-71: одна шапка на диалог — заголовок и пояснение живут в
       DialogHeader вызывающего экрана, здесь остаётся только форма. */
    <div className="space-y-6 text-white">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Загрузка файла */}
        <div className="space-y-2">
          <Label htmlFor="file" className="text-white">Excel файл (.xlsx)</Label>
          <FileInput
            id="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isUploading}
            showFileName={false}
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Выбран файл: {file.name}</span>
            </div>
          )}
        </div>

        {/* Основные данные */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="artistName" className="text-white">Имя исполнителя *</Label>
            <Input
              id="artistName"
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              disabled={isUploading}
              placeholder="Введите имя артиста"
              className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalAmount" className="text-white">Общая сумма (₽)</Label>
            <Input
              id="totalAmount"
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              disabled={isUploading}
              placeholder="Автоматически из файла"
              className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalPlays" className="text-white">Прослушивания</Label>
            <Input
              id="totalPlays"
              type="number"
              value={totalPlays}
              onChange={(e) => setTotalPlays(e.target.value)}
              disabled={isUploading}
              placeholder="Автоматически из файла"
              className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quarter" className="text-white">Квартал *</Label>
            <Select value={quarter} onValueChange={setQuarter} disabled={isUploading}>
              <SelectTrigger className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors">
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="year" className="text-white">Год</Label>
          <Input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            disabled={isUploading}
            className="bg-transparent border-slate-600/30 text-white hover:border-slate-500/60 focus:border-emerald-400 transition-colors w-32"
          />
        </div>

        {/* Кнопка загрузки */}
        <Button
          type="submit"
          variant="cta"
          disabled={isUploading || !file || !artistName.trim() || !quarter}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Загрузить отчёт
            </>
          )}
        </Button>
      </form>

      {/* Результат загрузки */}
      {result && (
        <Banner variant={result.success ? "success" : "danger"}>
          {result.message}
        </Banner>
      )}
    </div>
  )
}




