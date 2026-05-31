import ReportProcessor from "@/components/report-processor"
import Link from "next/link"

export default function ReportsGenerator() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col gap-6">
          <div className="flex items-center text-xs text-gray-500 font-mono uppercase tracking-widest space-x-2">
            <Link href="/dashboard/admin/dashboard" className="hover:text-primary transition-colors">
              ДАШБОРД
            </Link>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-white">Генератор отчётов</span>
          </div>
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

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between gap-4 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            System Operational
          </div>
          <div>ROSSEL LABEL ENGINE V2.4 | ADMIN</div>
        </footer>
      </div>
    )
}
