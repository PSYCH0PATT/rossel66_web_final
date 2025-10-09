import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getArtistReports } from "@/lib/data"
import { FileText, Download, Calendar } from "lucide-react"

export default function ReportsPage() {
  // В реальном приложении ID артиста будет получен из сессии
  const artistId = "1" // Это нужно будет заменить на получение ID из сессии
  const reports = getArtistReports(artistId)

  // Группировка отчетов по годам
  const reportsByYear = reports.reduce(
    (acc, report) => {
      if (!acc[report.year]) {
        acc[report.year] = []
      }
      acc[report.year].push(report)
      return acc
    },
    {} as Record<number, typeof reports>,
  )

  // Сортировка годов в порядке убывания
  const years = Object.keys(reportsByYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <Layout role="artist" requiredRole="artist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Отчеты</h1>

        {reports.length > 0 ? (
          <div className="space-y-8">
            {years.map((year) => (
              <div key={year} className="space-y-4">
                <h2 className="text-xl font-semibold text-white">{year}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {reportsByYear[year]
                    .sort((a, b) => {
                      // Сортировка по кварталам (Q1, Q2, Q3, Q4)
                      const quarterA = Number.parseInt(a.quarter.substring(1))
                      const quarterB = Number.parseInt(b.quarter.substring(1))
                      return quarterB - quarterA
                    })
                    .map((report) => (
                      <Card key={report.id} className="bg-card border-border text-card-foreground rounded-xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-purple-500/10">
                              <FileText className="h-5 w-5 text-category-purple" />
                            </div>
                            {report.quarter} {report.year}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
                            <Calendar className="h-4 w-4" />
                            <span>Загружен: {new Date(report.uploadDate).toLocaleDateString()}</span>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full border-category-purple text-category-purple hover:bg-purple-500/10 hover:text-category-purple rounded-xl"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Скачать отчет
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border-border text-card-foreground rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">У вас пока нет отчетов</h2>
            <p className="text-muted-foreground">
              Здесь будут отображаться ваши отчеты после их создания и загрузки в систему.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
