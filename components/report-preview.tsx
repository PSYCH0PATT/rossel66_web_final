"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

interface ReportPreviewProps {
  reportId: string
}

export function ReportPreview({ reportId }: ReportPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<string>("")

  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/reports/preview/${reportId}`)

        if (!response.ok) {
          throw new Error(`Ошибка при загрузке предварительного просмотра: ${response.status}`)
        }

        const data = await response.json()

        if (data.error) {
          throw new Error(data.error)
        }

        setPreviewData(data)

        // Устанавливаем первый лист как активный
        if (data.sheetNames && data.sheetNames.length > 0) {
          setActiveTab(data.sheetNames[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка")
        console.error("Ошибка при загрузке предварительного просмотра:", err)
      } finally {
        setLoading(false)
      }
    }

    if (reportId) {
      fetchPreviewData()
    }
  }, [reportId])

  if (loading) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-destructive mb-2">Ошибка при загрузке предварительного просмотра</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!previewData || !previewData.sheetNames || previewData.sheetNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">Нет данных для предварительного просмотра</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-4">
      <h3 className="text-lg font-medium">{previewData.fileName}</h3>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          {previewData.sheetNames.map((sheetName: string) => (
            <TabsTrigger key={sheetName} value={sheetName}>
              {sheetName}
            </TabsTrigger>
          ))}
        </TabsList>

        {previewData.sheetNames.map((sheetName: string) => (
          <TabsContent key={sheetName} value={sheetName} className="relative">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {previewData.previewData[sheetName].map((row: any[], rowIndex: number) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? "bg-muted font-medium" : "border-t"}>
                      {row.map((cell: any, cellIndex: number) => (
                        <td key={cellIndex} className="p-2 border text-sm">
                          {cell !== null && cell !== undefined ? String(cell) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
