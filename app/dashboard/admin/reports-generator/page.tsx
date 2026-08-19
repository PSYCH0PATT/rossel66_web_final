import ReportProcessor from "@/components/report-processor"
import { DashboardFooter } from "@/components/dashboard-footer"

export default function ReportsGenerator() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="border-b border-white/5 pb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight uppercase">
              Генератор отчётов
            </h1>
            <p className="text-sm text-gray-400 font-light mt-2 max-w-md">Обработка и распределение по артистам</p>
          </div>
        </div>

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2 mb-6">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            <span className="material-symbols-outlined text-primary">transform</span>
            Обработка
          </h2>
          <ReportProcessor />
        </div>

        <DashboardFooter />
      </div>
    )
}
