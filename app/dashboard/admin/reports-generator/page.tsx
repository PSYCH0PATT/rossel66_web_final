import ReportProcessor from "@/components/report-processor"
import { DashboardFooter } from "@/components/dashboard-footer"
import { PageHeader } from "@/components/ui/page-header"
import { SectionHeader } from "@/components/ui/section-header"

export default function ReportsGenerator() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
        <PageHeader
          size="md"
          title="Генератор отчётов"
          subtitle="Обработка и распределение по артистам"
        />

        <div className="card-glass rounded-2xl border border-white/5 p-6 md:p-8">
          <SectionHeader
            className="mb-6"
            size="sm"
            title={
              <>
                <span className="material-symbols-outlined text-primary" aria-hidden>
                  transform
                </span>
                Обработка
              </>
            }
          />
          <ReportProcessor />
        </div>

        <DashboardFooter />
      </div>
    )
}
