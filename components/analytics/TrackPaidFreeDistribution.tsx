import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TrackPaidFreeDistributionProps {
  totalPaid: number
  totalFree: number
}

export default function TrackPaidFreeDistribution({ totalPaid, totalFree }: TrackPaidFreeDistributionProps) {
  const total = totalPaid + totalFree
  
  // Handle empty or zero states
  const isZero = total === 0
  const paidPct = isZero ? 0 : (totalPaid / total) * 100
  const freePct = isZero ? 0 : (totalFree / total) * 100

  // Format pct smoothly without aggressive long numbers
  const formatPct = (val: number) => Number.isInteger(val) ? `${val}%` : `${val.toFixed(1)}%`

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
        <span className="text-emerald-500">Платные ({totalPaid.toLocaleString("ru-RU")})</span>
        <span className="text-gray-400">Бесплатные ({totalFree.toLocaleString("ru-RU")})</span>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="h-3 w-full bg-[#141414] border border-white/5 rounded-full flex overflow-hidden shadow-inner relative">
          {/* PAiD SEGMENT */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-all duration-500 cursor-crosshair z-10" 
                style={{ width: `${isZero ? 50 : paidPct}%`, opacity: isZero ? 0.1 : 1 }}
              />
            </TooltipTrigger>
            <TooltipContent align="center" className="bg-[#141414] border border-white/10 text-emerald-400 font-mono text-xs shadow-xl">
              Платные: {formatPct(paidPct)}
            </TooltipContent>
          </Tooltip>

          {/* FREE SEGMENT */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full bg-gray-500 transition-all duration-500 cursor-crosshair relative z-0" 
                style={{ width: `${isZero ? 50 : freePct}%`, opacity: isZero ? 0.1 : 1 }}
              />
            </TooltipTrigger>
            <TooltipContent align="center" className="bg-[#141414] border border-white/10 text-gray-300 font-mono text-xs shadow-xl">
              Бесплатные: {formatPct(freePct)}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
