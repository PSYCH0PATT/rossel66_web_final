import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload } from "lucide-react"
import ReportProcessor from "@/components/report-processor"

export default function ReportsGenerator() {
  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Генератор отчетов</h1>

        <Card className="bg-transparent border-slate-600/30 text-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Обработка и распределение отчетов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportProcessor />
          </CardContent>
        </Card>
      </div>
    </Layout>
  )
}
