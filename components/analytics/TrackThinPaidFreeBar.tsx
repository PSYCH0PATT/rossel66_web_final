import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TrackThinPaidFreeBarProps {
  paid: number
  free: number
  className?: string
  heightClass?: string
}

export function TrackThinPaidFreeBar({ paid, free, className = "", heightClass = "h-[4px]" }: TrackThinPaidFreeBarProps) {
  const total = paid + free
  if (total === 0) return null

  const pctPaid = (paid / total) * 100
  const pctFree = (free / total) * 100

  // Optional: add a tiny visual buffer to ensure segments aren't invisible
  const widthPaid = Math.max(0, Math.min(100, pctPaid))
  const widthFree = 100 - widthPaid

  const formatPct = (val: number) => Number.isInteger(val) ? `${val}%` : `${val.toFixed(1)}%`

  return (
    <TooltipProvider delayDuration={100}>
      <div className={`w-full bg-[#141414] rounded-full flex overflow-hidden ${heightClass} ${className}`}>
        {/* PAID SEGMENT */}
        {widthPaid > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full cursor-crosshair transition-all duration-300 relative z-10"
                style={{ 
                  width: `${widthPaid}%`, 
                  backgroundColor: "#10b981", 
                  boxShadow: "0 0 4px rgba(16,185,129,0.3)" 
                }}
              />
            </TooltipTrigger>
            <TooltipContent align="center" className="bg-[#141414] border border-white/10 text-emerald-400 font-mono text-xs shadow-xl">
              Платные: {formatPct(pctPaid)}
            </TooltipContent>
          </Tooltip>
        )}

        {/* FREE SEGMENT */}
        {widthFree > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="h-full cursor-crosshair transition-all duration-300 relative z-0"
                style={{ 
                  width: `${widthFree}%`, 
                  backgroundColor: "#4b5563" 
                }}
              />
            </TooltipTrigger>
            <TooltipContent align="center" className="bg-[#141414] border border-white/10 text-gray-300 font-mono text-xs shadow-xl">
              Бесплатные: {formatPct(pctFree)}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
