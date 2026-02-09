import Layout from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Users, Upload } from "lucide-react"
import ReportsList from "@/components/reports-list"
import UnregisteredReportsList from "@/components/unregistered-reports-list"
import SimpleReportUploader from "@/components/simple-report-uploader"

export default function ReportsPage() {
  return (
    <Layout role="admin" requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Отчеты</h1>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
            <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <FileText className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Зарегистрированные</span>
            </TabsTrigger>
            <TabsTrigger value="unregistered" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <Users className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Незарегистрированные</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-xs sm:text-sm">
              <Upload className="h-5 w-5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Загрузить отчеты</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <ReportsList />
          </TabsContent>

          <TabsContent value="unregistered" className="space-y-4">
            <UnregisteredReportsList />
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <SimpleReportUploader />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}