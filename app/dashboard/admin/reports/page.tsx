import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReportsList from "@/components/reports-list"
import UnregisteredReportsList from "@/components/unregistered-reports-list"
import SimpleReportUploader from "@/components/simple-report-uploader"
import Link from "next/link"
import { DashboardFooter } from "@/components/dashboard-footer"

export default function ReportsPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Отчёты</span>
          </div>
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">Отчёты</h1>
            <p className="text-sm text-gray-400 font-light mt-2 max-w-md">
              Зарегистрированные артисты, очередь без кабинета и загрузка файлов
            </p>
          </div>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-auto gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
            <TabsTrigger
              value="reports"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-lg sm:text-base">description</span>
              <span className="hidden sm:inline font-mono uppercase">Зарегистрированные</span>
            </TabsTrigger>
            <TabsTrigger
              value="unregistered"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-lg sm:text-base">person_off</span>
              <span className="hidden sm:inline font-mono uppercase">Без кабинета</span>
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border data-[state=active]:border-primary/30 text-gray-400 text-xs sm:text-sm"
            >
              <span className="material-symbols-outlined text-lg sm:text-base">upload</span>
              <span className="hidden sm:inline font-mono uppercase">Загрузка</span>
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

        <DashboardFooter />
      </div>
    )
}
