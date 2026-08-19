import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonLine } from "@/components/ui/skeleton-presets"

/**
 * C-14: страница отдавала пустой экран до прихода данных (`return null`).
 * Заглушка повторяет каркас: шапка, панель фильтров и сетка карточек.
 */
export default function Loading() {
  return (
    <div className="relative z-10 mx-auto max-w-7xl space-y-8 p-6 pb-24 md:p-10">
      <div className="border-b border-white/5 pb-8">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <SkeletonLine className="mt-3 w-80" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  )
}
