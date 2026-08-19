"use client"

import dynamic from "next/dynamic"

import { Spinner } from "@/components/ui/spinner"

function ChartSkeleton() {
  return (
    <div
      className="flex h-[280px] w-full items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]"
      aria-hidden
    >
      <Spinner />
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
