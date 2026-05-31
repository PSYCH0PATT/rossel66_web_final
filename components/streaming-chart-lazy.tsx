"use client"

import dynamic from "next/dynamic"

function ChartSkeleton() {
  return (
    <div
      className="flex h-[280px] w-full items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]"
      aria-hidden
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  )
}

export const StreamingChart = dynamic(
  () => import("@/components/streaming-chart").then((mod) => mod.StreamingChart),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  }
)
