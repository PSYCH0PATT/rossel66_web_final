"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ReportUploader() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [selectedQuarter, setSelectedQuarter] = useState("Q1")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles(filesArray)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter(
        (file) => file.name.endsWith(".xlsx") || file.name.endsWith(".xls"),
      )
      setSelectedFiles(filesArray)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadStatus("error")
      setStatusMessage("Пожалуйста, выберите файлы для загрузки")
      return
    }

    setIsUploading(true)
    setUploadStatus("idle")
    setStatusMessage("")

    try {
      const formData = new FormData()
      formData.append("quarter", selectedQuarter)

      selectedFiles.forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch("/api/reports/bulk-upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setUploadStatus("success")
        setStatusMessage(`Успешно загружено ${result.processedFiles} файлов`)
        setSelectedFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        setUploadStatus("error")
        setStatusMessage(result.error || "Произошла ошибка при загрузке файлов")
      }
    } catch (error) {
      console.error("Ошибка при загрузке файлов:", error)
      setUploadStatus("error")
      setStatusMessage(`Ошибка: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsUploading(false)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Tabs defaultValue="bulk-upload" className="w-full">
      <TabsList className="grid grid-cols-2 mb-4">
        <TabsTrigger value="generation">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Генерация отчётов
        </TabsTrigger>
        <TabsTrigger value="bulk-upload">
          <Upload className="mr-2 h-4 w-4" />
          Массовая загрузка
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generation">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Генерация отчётов</h2>
          <p className="text-gray-500 mb-4">Загрузите Excel-файл с данными для генерации отчётов для всех артистов.</p>
          {/* Здесь будет форма для генерации отчётов */}
        </Card>
      </TabsContent>

      <TabsContent value="bulk-upload">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Массовая загрузка отчётов</h2>
          <p className="text-gray-500 mb-4">
            Загрузите готовые отчёты для артистов. Имя файла должно соответствовать имени артиста (например,
            "передоз.xlsx").
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="files">Загрузите файлы отчётов (.xlsx)</Label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 mt-2 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Перетащите файлы сюда или</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Выберите файлы
                </Button>
                <Input
                  ref={fileInputRef}
                  id="files"
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Выбрано файлов: {selectedFiles.length}</h3>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFile(index)} className="h-6 w-6 p-0">
                        &times;
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="quarter">Выберите квартал</Label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger id="quarter" className="mt-2">
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

            <Button onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0} className="w-full">
              {isUploading ? "Загрузка..." : "Загрузить отчёты"}
            </Button>

            {uploadStatus !== "idle" && (
              <Alert variant={uploadStatus === "success" ? "default" : "destructive"} className="mt-4">
                {uploadStatus === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>{uploadStatus === "success" ? "Успешно" : "Ошибка"}</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
